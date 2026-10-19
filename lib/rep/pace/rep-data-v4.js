import Debug from "debug";
import { getConnection } from "chums-local-modules";
import { addTotals, parseRepSlug, rollupRepPace } from "./utils.js";
const debug = Debug('chums:lib:rep:pace:rep-data');
const sql = `
    DROP TEMPORARY TABLE IF EXISTS _DistinctUserReps;
    CREATE TEMPORARY TABLE _DistinctUserReps LIKE c2.TEMP_RP_DistinctUserReps;

    INSERT IGNORE INTO _DistinctUserReps
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
                                     WHERE Level < r.Level)))
    SELECT r.*
    FROM DistinctUserReps r;

    DROP TEMPORARY TABLE IF EXISTS _RepCustomers;
    CREATE TEMPORARY TABLE _RepCustomers LIKE c2.TEMP_RP_RepCustomers;
    INSERT INTO _RepCustomers
    WITH Customers AS (SELECT c.ARDivisionNo,
                              c.CustomerNo,
                              ''                                           AS ShipToCode,
                              CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) AS CustomerCode,
                              c.CustomerName,
                              c.EmailAddress,
                              r.SalespersonCode,
                              c.SalespersonDivisionNo,
                              c.SalespersonNo
                       FROM c2.ar_customer c
                                INNER JOIN _DistinctUserReps r
                                           ON c.SalespersonDivisionNo = r.SalespersonDivisionNo AND
                                              c.SalespersonNo = r.SalespersonNo
                       WHERE c.CustomerStatus = 'A'

                       UNION

                       SELECT st.ARDivisionNo,
                              st.CustomerNo,
                              st.ShipToCode,
                              CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo, st.ShipToCode) AS CustomerCode,
                              st.ShipToName,
                              st.EmailAddress,
                              r.SalespersonCode,
                              st.SalespersonDivisionNo,
                              st.SalespersonNo
                       FROM c2.ar_customer c
                                INNER JOIN SO_ShipToAddress st
                                           ON c.ARDivisionNo = st.ARDivisionNo AND c.CustomerNo = st.CustomerNo
                                INNER JOIN _DistinctUserReps r
                                           ON st.SalespersonDivisionNo = r.SalespersonDivisionNo AND
                                              st.SalespersonNo = r.SalespersonNo
                       WHERE c.CustomerStatus = 'A')
    SELECT r.SalesManagerCode,
           r.SalespersonCode,
           r.SalespersonName,
           r.Level,
           c.ARDivisionNo,
           c.CustomerNo,
           c.ShipToCode,
           c.CustomerCode,
           c.CustomerName,
           c.EmailAddress,
           c.SalespersonDivisionNo,
           c.SalespersonNo
    FROM _DistinctUserReps r
             INNER JOIN Customers c ON r.SalespersonCode = c.SalespersonCode;

    WITH ReportDates AS (SELECT :fromDate                                                  AS cyFrom,
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
                               INNER JOIN _RepCustomers c
                                          ON ih.ARDivisionNo = c.ARDivisionNo AND
                                             ih.CustomerNo = c.CustomerNo AND
                                             IFNULL(ih.ShipToCode, '') = c.ShipToCode
                      WHERE ih.InvoiceType <> 'XD'
                        AND ih.InvoiceDate BETWEEN d.p2Start AND d.cyEnd
                      GROUP BY SalespersonCode),
         OpenOrders AS (SELECT c.SalespersonCode,
                               SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt - oh.InvoicedAmt) AS OpenTotal
                        FROM ReportDates d,
                             SO_SalesOrderHistoryHeader oh
                                 INNER JOIN _RepCustomers c
                                            ON oh.ARDivisionNo = c.ARDivisionNo AND
                                               oh.CustomerNo = c.CustomerNo AND
                                               IFNULL(oh.ShipToCode, '') = c.ShipToCode
                        WHERE oh.OrderType NOT IN ('M', 'Q')
                          AND oh.OrderStatus NOT IN ('C', 'X')
                          AND oh.ShipExpireDate <= d.cyEnd
                        GROUP BY SalespersonCode),
         RepCustomersCount AS (SELECT c.SalespersonCode,
                                 COUNT(c.CustomerCode) AS count
                          FROM _RepCustomers c
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
    FROM _DistinctUserReps r
             LEFT JOIN RepCustomersCount c
                       ON r.SalespersonCode = c.SalespersonCode
             LEFT JOIN Invoiced i
                       ON r.SalespersonCode = i.SalespersonCode
             LEFT JOIN OpenOrders o
                       ON r.SalespersonCode = o.SalespersonCode
    ORDER BY r.Level, r.SalesManagerCode, r.SalespersonCode;
`;
export async function loadRepPaceV4(props) {
    let connection = null;
    try {
        const params = {
            userId: props.userid,
            topDivisionNo: props.SalespersonDivisionNo,
            topSalespersonNo: props.SalespersonNo,
            fromDate: props.minDate,
            toDate: props.maxDate,
        };
        connection = await getConnection({ multipleStatements: true });
        const [results] = await connection.query(sql, params);
        await connection.end();
        const rows = results[6] ?? [];
        return rows.map(row => {
            return {
                SalesManagerCode: row.SalesManagerCode,
                SalespersonCode: row.SalespersonCode,
                SalespersonName: row.SalespersonName,
                Level: row.Level,
                totals: addTotals(null, row)
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadRepPaceV4()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepPaceV4()", err);
        return Promise.reject(new Error('Error in loadRepPaceV4()'));
    }
    finally {
        connection?.end();
    }
}
export async function getRepPaceV4(req, res) {
    try {
        const { salespersonDivisionNo, salespersonNo } = parseRepSlug(req.query.rep ?? '');
        const data = await loadRepPaceV4({
            userid: res.locals.profile.user.id,
            SalespersonDivisionNo: salespersonDivisionNo ?? null,
            SalespersonNo: salespersonNo ?? null,
            minDate: req.query.minDate,
            maxDate: req.query.maxDate,
        });
        res.set('Cache-Control', 'private, max-age=3600'); // 60 minutes
        // res.json(data);
        res.json(rollupRepPace(data));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepPaceV4()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getRepPaceV4()' });
    }
}
