import type {
    CustomerPaceRecord,
    CustomerPaceRecordV4,
    CustomerPaceRow,
    CustomerPaceRowV4,
    LoadRepPaceProps
} from "./types.js";
import {type Connection, getConnection, type ValidatedUser} from "chums-local-modules";
import Debug from "debug";
import {customerTotals, parseRepSlug} from "./utils.js";
import type {Request, Response} from "express";
import type {QueryResult, ResultSetHeader} from "mysql2";

const debug = Debug('chums:lib:rep:pace:rep-customers-v4');

const sqlAssignedCustomers = `
    DROP TEMPORARY TABLE IF EXISTS c2._DistinctUserReps;
    CREATE TEMPORARY TABLE c2._DistinctUserReps LIKE c2.TEMP_RP_DistinctUserReps;

    INSERT IGNORE INTO c2._DistinctUserReps
    WITH IsEmployee AS (SELECT 1 AS IsEmployee
                        FROM users.users
                        WHERE id = :userId
                          AND active = 1
                          AND accountType = 1),
         Salesperson AS (SELECT sp.SalesManagerNo,
                                sp.SalesManagerDivisionNo,
                                sp.SalespersonNo,
                                sp.SalespersonDivisionNo,
                                sp.SalespersonName,
                                0                                                            AS Level,
                                CONCAT_WS('-', sp.SalesManagerDivisionNo, sp.SalesManagerNo) AS SalesManagerCode,
                                CONCAT_WS('-', sp.SalespersonDivisionNo, sp.SalespersonNo)   AS SalespersonCode
                         FROM c2.ar_salesperson sp
                         WHERE sp.SalespersonDivisionNo = :salespersonDivisionNo
                           AND sp.SalespersonNo = :salespersonNo
                           AND (
                             EXISTS (SELECT 1 FROM IsEmployee)
                                 OR EXISTS (SELECT 1
                                            FROM users.UserCustomerAccess uac
                                            WHERE uac.userId = :userId
                                              AND uac.SalespersonDivisionNo = sp.SalespersonDivisionNo
                                              AND uac.SalespersonNo = sp.SalespersonNo)
                             ))
    SELECT *
    FROM Salesperson;

    DROP TEMPORARY TABLE IF EXISTS c2._RepCustomers;
    CREATE TEMPORARY TABLE c2._RepCustomers LIKE c2.TEMP_RP_RepCustomers;
    INSERT INTO c2._RepCustomers
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
                                INNER JOIN c2.SO_ShipToAddress st
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
         Customers AS (SELECT rc.ARDivisionNo,
                              rc.CustomerNo,
                              CONCAT_WS('-', rc.ARDivisionNo, rc.CustomerNo) AS CustomerCode,
                              c.CustomerName,
                              IF(EXISTS(SELECT 1
                                        FROM c2._RepCustomers
                                        WHERE ARDivisionNo = rc.ARDivisionNo
                                          AND CustomerNo = rc.CustomerNo
                                          AND ShipToCode = ''),
                                 1, 0)                                       AS BillTo,
                              COUNT(DISTINCT NULLIF(rc.ShipToCode, ''))      AS ShipTo
                       FROM c2._RepCustomers rc
                                INNER JOIN c2.AR_Customer2 c
                                           ON rc.ARDivisionNo = c.ARDivisionNo AND rc.CustomerNo = c.CustomerNo
                       GROUP BY rc.ARDivisionNo,
                                rc.CustomerNo,
                                CONCAT_WS('-', rc.ARDivisionNo, rc.CustomerNo),
                                c.CustomerName),
         Invoiced AS (SELECT c.ARDivisionNo,
                             c.CustomerNo,
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
                           _RepCustomers c
                               INNER JOIN c2.ar_invoicehistoryheader ih
                                          ON c.ARDivisionNo = ih.ARDivisionNo AND
                                             c.CustomerNo = ih.CustomerNo AND
                                             c.ShipToCode = IFNULL(ih.ShipToCode, '')
                      WHERE ih.InvoiceType <> 'XD'
                        AND ih.InvoiceDate BETWEEN d.p2Start AND d.cyEnd
                      GROUP BY c.ARDivisionNo, c.CustomerNo),
         OpenOrders AS (SELECT c.ARDivisionNo,
                               c.CustomerNo,
                               SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt - oh.InvoicedAmt) AS OpenTotal
                        FROM ReportDates d,
                             _RepCustomers c
                                 INNER JOIN c2.SO_SalesOrderHistoryHeader oh
                                            ON c.ARDivisionNo = oh.ARDivisionNo AND
                                               c.CustomerNo = oh.CustomerNo AND
                                               c.ShipToCode = IFNULL(oh.ShipToCode, '')
                        WHERE oh.OrderType NOT IN ('M', 'Q')
                          AND oh.OrderStatus NOT IN ('C', 'X')
                          AND oh.ShipExpireDate <= d.cyEnd
                        GROUP BY c.ARDivisionNo, c.CustomerNo)
    SELECT CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) AS CustomerCode,
           c.CustomerName,
           c.BillTo,
           c.ShipTo,
           NULL                                         AS EmailAddress,
           o.OpenTotal,
           i.InvCYTD,
           i.InvCY,
           i.InvPYTD,
           i.InvPY,
           i.InvP2TD,
           i.InvP2
    FROM Customers c
             LEFT JOIN Invoiced i ON c.ARDivisionNo = i.ARDivisionNo AND c.CustomerNo = i.CustomerNo
             LEFT JOIN OpenOrders o ON c.ARDivisionNo = o.ARDivisionNo AND c.CustomerNo = o.CustomerNo
#     WHERE COALESCE(i.ARDivisionNo, o.ARDivisionNo) IS NOT NULL
    ORDER BY CustomerCode;
`;

type MultipleQueryTuple = QueryResult & [
    ResultSetHeader,
    ResultSetHeader,
    ResultSetHeader,
    ResultSetHeader,
    ResultSetHeader,
    ResultSetHeader,
    CustomerPaceRowV4[]
]

export async function loadAssignedCustomersV4(arg: LoadRepPaceProps): Promise<CustomerPaceRecordV4[]> {
    let connection: Connection | null = null;
    try {
        connection = await getConnection({multipleStatements: true});
        const [result] = await connection.query<MultipleQueryTuple>(sqlAssignedCustomers, {
            userId: arg.userid,
            salespersonDivisionNo: arg.SalespersonDivisionNo ?? null,
            salespersonNo: arg.SalespersonNo ?? null,
            fromDate: arg.minDate,
            toDate: arg.maxDate,
        });
        debug('loadAssignedCustomersV4()', result.length);
        const repCustomers = result[6] ?? [];
        return repCustomers.map(row => {
            return {
                CustomerCode: row.CustomerCode,
                CustomerName: row.CustomerName,
                EmailAddress: row.EmailAddress,
                BillTo: row.BillTo ?? null,
                ShipTo: row.ShipTo ?? null,
                totals: customerTotals(row)
            }
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadAssignedCustomersV4()", err.message);
            return Promise.reject(err);
        }
        debug("loadAssignedCustomersV4()", err);
        return Promise.reject(new Error('Error in loadAssignedCustomersV4()'));
    } finally {
        await connection?.end();
    }
}

export async function getAssignedCustomersV4(req: Request, res: Response<unknown, ValidatedUser>): Promise<void> {
    try {
        const {salespersonDivisionNo, salespersonNo} = parseRepSlug(req.query.rep as string ?? '');
        const customers = await loadAssignedCustomersV4({
            userid: res.locals.profile.user.id,
            SalespersonDivisionNo: salespersonDivisionNo ?? null,
            SalespersonNo: salespersonNo ?? null,
            minDate: req.query.minDate as string,
            maxDate: req.query.maxDate as string,
        })
        res.json(customers);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getAssignedCustomersV4()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getAssignedCustomersV4()'});
    }
}
