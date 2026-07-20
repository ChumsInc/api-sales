import type {LoadRepPaceProps, RepPaceRecord, RepPaceRow} from "./types.js";
import Debug from "debug";
import dayjs from "dayjs";
import {mysql2Pool, type ValidatedUser} from "chums-local-modules";
import {addTotals, parseRepSlug, rollupRepPace} from "./utils.js";
import type {Request, Response} from "express";

const debug = Debug('chums:lib:rep:pace:rep-data');

const sqlEmployee = `
    WITH RECURSIVE
        IsEmployee AS (SELECT 1 AS IsEmployee
                       FROM users.users
                       WHERE id = :userId
                         AND active = 1
                         AND accountType = 1),
        UserReps (SalesManagerDivisionNo, SalesManagerNo, SalespersonDivisionNo, SalespersonNo, SalespersonName, Level)
            AS (SELECT sp.SalesManagerDivisionNo,
                       sp.SalesManagerNo,
                       sp.SalespersonDivisionNo,
                       sp.SalespersonNo,
                       sp.SalespersonName,
                       0 AS Level
                FROM c2.ar_salesperson sp
                         INNER JOIN users.UserCustomerAccess uac
                                    ON sp.SalespersonDivisionNo LIKE uac.SalespersonDivisionNo AND
                                       sp.SalespersonNo LIKE uac.SalespersonNo
                WHERE uac.userId = :userId
                  AND IFNULL(sp.UDF_TERMINATED, 'N') <> 'Y'
                  AND IF((SELECT COUNT(*) > 0 FROM IsEmployee),
                         (
                             (sp.SalespersonDivisionNo = :topDivisionNo AND sp.SalespersonNo = :topSalespersonNo)
                                 OR
                             (:topDivisionNo IS NULL AND :topSalespersonNo IS NULL AND
                              sp.SalesManagerDivisionNo IS NULL AND
                              sp.SalesManagerNo IS NULL)
                             ),
                         (sp.SalespersonDivisionNo = :topDivisionNo AND sp.SalespersonNo = :topSalespersonNo)
                             OR (:topDivisionNo IS NULL AND :topSalespersonNo IS NULL)
                      )

                UNION ALL

                SELECT sp.SalesManagerDivisionNo,
                       sp.SalesManagerNo,
                       sp.SalespersonDivisionNo,
                       sp.SalespersonNo,
                       sp.SalespersonName,
                       Level + 1
                FROM c2.ar_salesperson sp
                         INNER JOIN UserReps r ON sp.SalesManagerDivisionNo = r.SalespersonDivisionNo AND
                                                  sp.SalesManagerNo = r.SalespersonNo
                WHERE IFNULL(sp.UDF_TERMINATED, 'N') <> 'Y'),
        DistinctUserReps AS (SELECT r.SalesManagerNo,
                                   r.SalesManagerDivisionNo,
                                   r.SalespersonNo,
                                   r.SalespersonDivisionNo,
                                   r.SalespersonName,
                                   r.Level,
                                   CONCAT_WS('-', r.SalesManagerDivisionNo, r.SalesManagerNo) AS SalesManagerCode,
                                   CONCAT_WS('-', r.SalespersonDivisionNo, r.SalespersonNo)   AS SalespersonCode
                            FROM UserReps r
                            WHERE r.Level = 0
                               OR (CONCAT_WS('-', r.SalespersonDivisionNo, r.SalespersonNo) NOT IN
                                   (SELECT DISTINCT CONCAT_WS('-', SalespersonDivisionNo, SalespersonNo)
                                    FROM UserReps
                                    WHERE Level < r.Level))),
        ReportDates AS (SELECT :fromDate                                                  AS cyFrom,
                               :toDate                                                    AS cyTo,
                               DATE_SUB(:fromDate, INTERVAL 1 YEAR)                       AS pyFrom,
                               DATE_SUB(:toDate, INTERVAL 1 YEAR)                         AS pyTo,
                               DATE_SUB(:fromDate, INTERVAL 2 YEAR)                       AS p2From,
                               DATE_SUB(:toDate, INTERVAL 2 YEAR)                         AS p2To,
                               MAKEDATE(YEAR(:fromDate), 1)                               AS cyStart,
                               LAST_DAY(MAKEDATE(YEAR(:fromDate), 365))                   AS cyEnd,
                               MAKEDATE(YEAR(:fromDate), 1) - INTERVAL 1 YEAR             AS pyStart,
                               LAST_DAY(MAKEDATE(YEAR(:fromDate), 365)) - INTERVAL 1 YEAR AS pyEnd,
                               MAKEDATE(YEAR(:fromDate), 1) - INTERVAL 2 YEAR             AS p2Start,
                               LAST_DAY(MAKEDATE(YEAR(:fromDate), 365)) - INTERVAL 2 YEAR AS p2End),
        Customers AS (SELECT c.ARDivisionNo,
                             c.CustomerNo,
                             NULL                                              AS ShipToCode,
                             CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo, '%') AS CustomerCode,
                             c.CustomerName,
                             c.EmailAddress,
                             r.SalespersonCode
                      FROM c2.ar_customer c
                               INNER JOIN DistinctUserReps r
                                          ON CONCAT_WS('-', c.SalespersonDivisionNo, c.SalespersonNo) =
                                             r.SalespersonCode
                      WHERE c.CustomerStatus = 'A'

                      UNION

                      SELECT st.ARDivisionNo,
                             st.CustomerNo,
                             st.ShipToCode,
                             CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo, st.ShipToCode) AS CustomerCode,
                             st.ShipToName,
                             st.EmailAddress,
                             r.SalespersonCode
                      FROM c2.ar_customer c
                               INNER JOIN SO_ShipToAddress st
                                          ON c.ARDivisionNo = st.ARDivisionNo AND c.CustomerNo = st.CustomerNo
                               INNER JOIN DistinctUserReps r
                                          ON CONCAT_WS('-', st.SalespersonDivisionNo, st.SalespersonNo) =
                                             r.SalespersonCode
                      WHERE c.CustomerStatus = 'A'
                        AND NOT (c.SalespersonDivisionNo = st.SalespersonDivisionNo AND
                                 c.SalespersonNo = st.SalespersonNo)),
        Invoiced AS (SELECT c.SalespersonCode,
                            SUM(
                                    IF(ih.InvoiceDate BETWEEN d.cyFrom AND d.cyTo,
                                       ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt,
                                       0
                                    )
                            ) AS InvCYTD,
                            SUM(
                                    IF(ih.InvoiceDate BETWEEN d.cyStart AND d.cyEnd,
                                       ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt,
                                       0
                                    )
                            ) AS InvCY,
                            SUM(
                                    IF(ih.InvoiceDate BETWEEN d.pyFrom AND d.pyTo,
                                       ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt,
                                       0
                                    )
                            ) AS InvPYTD,
                            SUM(
                                    IF(ih.InvoiceDate BETWEEN d.pyStart AND d.pyEnd,
                                       ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt,
                                       0
                                    )
                            ) AS InvPY,
                            SUM(
                                    IF(ih.InvoiceDate BETWEEN d.p2From AND d.p2To,
                                       ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt,
                                       0
                                    )
                            ) AS InvP2TD,
                            SUM(
                                    IF(ih.InvoiceDate BETWEEN d.p2Start AND d.p2End,
                                       ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt,
                                       0
                                    )
                            ) AS InvP2

                     FROM ReportDates d,
                          c2.ar_invoicehistoryheader ih
                              INNER JOIN Customers c
                                         ON ih.ARDivisionNo = c.ARDivisionNo AND ih.CustomerNo = c.CustomerNo AND
                                            IFNULL(ih.ShipToCode, '') LIKE IFNULL(c.ShipToCode, '%')
                     WHERE ih.InvoiceType <> 'XD'
                       AND ih.InvoiceDate BETWEEN d.p2Start AND d.cyEnd
                     GROUP BY SalespersonCode),
        OpenOrders AS (SELECT c.SalespersonCode,
                              SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt - oh.InvoicedAmt) AS OpenTotal
                       FROM ReportDates d,
                            SO_SalesOrderHistoryHeader oh
                                INNER JOIN Customers c
                                           ON oh.ARDivisionNo = c.ARDivisionNo AND oh.CustomerNo = c.CustomerNo AND
                                              IFNULL(oh.ShipToCode, '') LIKE IFNULL(c.ShipToCode, '%')
                       WHERE oh.OrderType NOT IN ('M', 'Q')
                         AND oh.OrderStatus NOT IN ('C', 'X')
                         AND oh.ShipExpireDate <= d.cyEnd
                       GROUP BY SalespersonCode),
        RepCustomers AS (SELECT c.SalespersonCode,
                                COUNT(c.CustomerCode) AS count
                         FROM Customers c
                         GROUP BY c.SalespersonCode)
    SELECT r.SalesManagerCode,
           r.SalespersonCode,
           r.SalespersonName,
           r.Level,
           o.OpenTotal,
           i.InvCYTD,
           i.InvCY,
           i.InvPYTD,
           i.InvPY,
           i.InvP2TD,
           i.InvP2,
           c.count
    FROM DistinctUserReps r
             LEFT JOIN RepCustomers c
                       ON r.SalespersonCode = c.SalespersonCode
             LEFT JOIN Invoiced i
                       ON r.SalespersonCode = i.SalespersonCode
             LEFT JOIN OpenOrders o
                       ON r.SalespersonCode = o.SalespersonCode
    ORDER BY r.Level, r.SalesManagerCode, r.SalespersonCode
`

export async function loadRepPaceV3(props: LoadRepPaceProps): Promise<RepPaceRecord[]> {
    try {
        const params = {
            userId: props.userid,
            topDivisionNo: props.SalespersonDivisionNo,
            topSalespersonNo: props.SalespersonNo,
            fromDate: props.minDate,
            toDate: props.maxDate,
        }
        const [rows] = await mysql2Pool.query<RepPaceRow[]>(sqlEmployee, params);
        return rows.map(row => {
            return {
                SalesManagerCode: row.SalesManagerCode,
                SalespersonCode: row.SalespersonCode,
                SalespersonName: row.SalespersonName,
                Level: row.Level,
                totals: addTotals(null, row)
            }
        })
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadRepPace()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepPace()", err);
        return Promise.reject(new Error('Error in loadRepPace()'));
    }
}

export async function getRepPaceV3(req: Request, res: Response<unknown, ValidatedUser>) {
    try {
        const {salespersonDivisionNo, salespersonNo} = parseRepSlug(req.query.rep as string ?? '');
        const data = await loadRepPaceV3({
            userid: res.locals.profile.user.id,
            SalespersonDivisionNo: salespersonDivisionNo ?? null,
            SalespersonNo: salespersonNo ?? null,
            minDate: req.query.minDate as string,
            maxDate: req.query.maxDate as string,
        });

        res.set('Cache-Control', 'private, max-age=3600'); // 60 minutes
        res.json(rollupRepPace(data));
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getRepPaceV3()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getRepPaceV3'});
    }
}

