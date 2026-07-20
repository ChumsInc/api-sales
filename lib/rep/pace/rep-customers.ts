import type {CustomerPaceRecord, CustomerPaceRow, LoadRepPaceProps} from "./types.js";
import {mysql2Pool, type ValidatedUser} from "chums-local-modules";
import Debug from "debug";
import {customerTotals, parseRepSlug} from "./utils.js";
import type {Request, Response} from "express";

const debug = Debug('chums:lib:rep:pace:rep-customers');

const sqlManagedCustomers = `
    WITH RECURSIVE
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
        DistinctUserReps AS (SELECT DISTINCT r.SalespersonDivisionNo, r.SalespersonNo, r.SalespersonName
                            FROM UserReps r
                            WHERE SalespersonDivisionNo = :salespersonDivisionNo
                              AND SalespersonNo = :salespersonNo),
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
                             NULL                                         AS ShipToCode,
                             CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) AS CustomerCode,
                             c.CustomerName,
                             c.EmailAddress
                      FROM c2.ar_customer c
                               INNER JOIN DistinctUserReps r ON c.SalespersonDivisionNo = r.SalespersonDivisionNo AND
                                                               c.SalespersonNo = r.SalespersonNo
                      WHERE c.CustomerStatus = 'A'

                      UNION

                      SELECT st.ARDivisionNo,
                             st.CustomerNo,
                             st.ShipToCode,
                             CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo, st.ShipToCode) AS CustomerCode,
                             st.ShipToName,
                             st.EmailAddress
                      FROM c2.ar_customer c
                               INNER JOIN SO_ShipToAddress st
                                          ON c.ARDivisionNo = st.ARDivisionNo AND c.CustomerNo = st.CustomerNo
                               INNER JOIN DistinctUserReps r ON st.SalespersonDivisionNo = r.SalespersonDivisionNo AND
                                                               st.SalespersonNo = r.SalespersonNo
                      WHERE c.CustomerStatus = 'A'
                        AND NOT (c.SalespersonDivisionNo = st.SalespersonDivisionNo AND
                                 c.SalespersonNo = st.SalespersonNo)
                      ORDER BY CustomerCode),
        Invoices AS (SELECT c.CustomerCode,
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
                     GROUP BY c.CustomerCode),
        OpenOrders AS (SELECT c.CustomerCode,
                              SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt - oh.InvoicedAmt) AS OpenTotal
                       FROM ReportDates d,
                            c2.SO_SalesOrderHistoryHeader oh
                                INNER JOIN Customers c
                                           ON oh.ARDivisionNo = c.ARDivisionNo AND oh.CustomerNo = c.CustomerNo AND
                                              IFNULL(oh.ShipToCode, '') LIKE IFNULL(c.ShipToCode, '%')
                       WHERE OrderType NOT IN ('M', 'Q')
                         AND OrderStatus NOT IN ('C', 'X')
                         AND oh.ShipExpireDate <= d.cyEnd
                       GROUP BY c.CustomerCode)
    SELECT c.CustomerCode,
           c.CustomerName,
           c.EmailAddress,
           o.OpenTotal,
           i.InvCYTD,
           i.InvCY,
           i.InvPYTD,
           i.InvPY,
           i.InvP2TD,
           i.InvP2
    FROM Customers c
             LEFT JOIN Invoices i ON i.CustomerCode = c.CustomerCode
             LEFT JOIN OpenOrders o ON o.CustomerCode = c.CustomerCode
`;


export async function loadManagedCustomers(arg: LoadRepPaceProps): Promise<CustomerPaceRecord[]> {
    try {
        const [repCustomers] = await mysql2Pool.query<CustomerPaceRow[]>(sqlManagedCustomers, {
            userId: arg.userid,
            salespersonDivisionNo: arg.SalespersonDivisionNo ?? null,
            salespersonNo: arg.SalespersonNo ?? null,
            fromDate: arg.minDate,
            toDate: arg.maxDate,
        });
        return repCustomers.map(row => {
            return {
                CustomerCode: row.CustomerCode,
                CustomerName: row.CustomerName,
                EmailAddress: row.EmailAddress,
                totals: customerTotals(row)
            }
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadManagedCustomers()", err.message);
            return Promise.reject(err);
        }
        debug("loadManagedCustomers()", err);
        return Promise.reject(new Error('Error in loadManagedCustomers()'));
    }
}

export async function getManagedCustomers(req: Request, res: Response<unknown, ValidatedUser>): Promise<void> {
    try {
        const {salespersonDivisionNo, salespersonNo} = parseRepSlug(req.query.rep as string ?? '');
        const customers = await loadManagedCustomers({
            userid: res.locals.profile.user.id,
            SalespersonDivisionNo: salespersonDivisionNo ?? null,
            SalespersonNo: salespersonNo ?? null,
            minDate: req.query.minDate as string,
            maxDate: req.query.maxDate as string,
        })
        res.json(customers);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getManagedCustomers()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getManagedCustomers'});
    }
}
