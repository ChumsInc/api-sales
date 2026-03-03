import {mysql2Pool} from "chums-local-modules";
import type {AccountListData, AccountListProps, RepAccountListTotal} from "./account-list-types.js";
import {buildAccountListGoal, getAccountListDates} from "./utils.js";
import type {RowDataPacket} from "mysql2";
import Debug from "debug";

const debug = Debug('chums:lib:rep:account-list:rep-bill-to-total');

type BillToTotalRow = RowDataPacket & Omit<RepAccountListTotal, 'YTDTotal' | 'pctChange' | 'CYGoal'>

export async function loadRepBillToTotal({userId, asOfDate}: Omit<AccountListProps, 'salespersonNo'>): Promise<AccountListData[]> {
    try {
        const {CYCurrDate} = getAccountListDates(asOfDate)
        const sql = `SELECT c.SalespersonDivisionNo,
                            c.SalespersonNo,
                            rep.SalespersonName,
                            IF(ISNULL(rep.SalespersonNo), 'Y', IFNULL(rep.UDF_TERMINATED, 'N')) AS TerminatedRep,
                            COUNT(DISTINCT c.Company, c.ARDivisionNo, c.CustomerNo)             AS Customers,
                            SUM(IFNULL(InvCY.InvCYTD, 0))                                       AS InvCYTD,
                            SUM(IFNULL(OpenCY.total, 0))                                        AS OpenOrders,
                            SUM(IFNULL(InvPYTD.total, 0))                                       AS InvPYTD,
                            SUM(IFNULL(InvPYr.total, 0))                                        AS InvPYr
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                           FROM users.user_AR_Customer
                           WHERE userid = :userId) ac
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = ac.Company AND c.ARDivisionNo = ac.ARDivisionNo AND
                                            c.CustomerNo = ac.CustomerNo
                              LEFT JOIN c2.ar_salesperson rep
                                        ON rep.Company = c.Company
                                            AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                            AND rep.SalespersonNo = c.SalespersonNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvCYTD
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(:CYCurrDate)
                                           AND InvoiceDate <= :CYCurrDate
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvCY
                                        ON InvCY.Company = c.Company AND
                                           InvCY.ARDivisionNo = c.ARDivisionNo AND
                                           InvCY.CustomerNo = c.CustomerNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo) OpenCY
                                        ON OpenCY.Company = c.Company
                                            AND OpenCY.ARDivisionNo = c.ARDivisionNo
                                            AND OpenCY.CustomerNo = c.CustomerNo

                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvPYTD
                                        ON InvPYTD.Company = c.Company
                                            AND InvPYTD.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYTD.CustomerNo = c.CustomerNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvPYr
                                        ON InvPYr.Company = c.Company AND InvPYr.ARDivisionNo = c.ARDivisionNo AND
                                           InvPYr.CustomerNo = c.CustomerNo
                     WHERE c.Company = 'chums'
                       AND c.CustomerStatus = 'A'
                       AND c.ARDivisionNo NOT IN ('00', '10')
                     GROUP BY c.Company, c.SalespersonDivisionNo, c.SalespersonNo
                     ORDER BY c.Company, c.SalespersonDivisionNo, c.SalespersonNo`;
        const args = {userId, CYCurrDate};
        const [rows] = await mysql2Pool.query<BillToTotalRow[]>(sql, args);

        return rows.map(row => {
            return {
                ...row,
                ...buildAccountListGoal(row),
            }
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadRepBillToTotal()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepBillToTotal()", err);
        return Promise.reject(new Error('Error in loadRepBillToTotal()'));
    }
}
