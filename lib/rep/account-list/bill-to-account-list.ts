import {mysql2Pool} from "chums-local-modules";
import {buildAccountListGoal, getAccountListDates} from "./utils.js";
import type {RowDataPacket} from "mysql2";
import type {AccountListProps, RepAccountWithSales} from "./account-list-types.js";
import Debug from "debug";

const debug = Debug('chums:lib:rep:account-list:bill-to-account-list');

type RepAccountWithSalesRow =
    RowDataPacket
    & Omit<RepAccountWithSales, 'YTDTotal' | 'pctChange' | 'CYGoal' | 'YTDGoalPct'>;


export async function loadBillToAccountList({userId, salespersonNo, asOfDate}: AccountListProps): Promise<RepAccountWithSales[]> {
    try {
        const {CYCurrDate} = getAccountListDates(asOfDate);
        const sql = `SELECT c.ARDivisionNo,
                            c.CustomerNo,
                            c.CustomerName,
                            CONCAT_WS(', ', c.city, c.state, c.zipcode) AS CityStateZip,
                            c.ZipCode,
                            c.DateLastActivity,
                            c.SalespersonDivisionNo,
                            c.SalespersonNo,
                            rep.SalespersonName,
                            IFNULL(InvCY.InvCYTD, 0)                    AS InvCYTD,
                            IFNULL(OpenCY.total, 0)                     AS OpenOrders,
                            IFNULL(InvPYTD.total, 0)                    AS InvPYTD,
                            IFNULL(InvPYr.total, 0)                     AS InvPYr
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                           FROM users.user_AR_Customer
                           WHERE userid = :userId) ac
                              INNER JOIN c2.ar_customer c
                                         ON ac.Company = c.Company AND
                                            ac.ARDivisionNo = c.ARDivisionNo AND
                                            ac.CustomerNo = c.CustomerNo
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
                       AND (IFNULL(:salespersonNo, '') = '' OR c.SalespersonNo = :salespersonNo)
                       AND c.ARDivisionNo NOT IN ('00', '10')
                     ORDER BY InvCYTD + InvPYr DESC,
                              InvCYTD DESC,
                              InvPYr DESC`;
        const args = {
            userId,
            CYCurrDate,
            salespersonNo
        };

        const [rows] = await mysql2Pool.query<RepAccountWithSalesRow[]>(sql, args);
        return rows.map(row => {
            return {
                ...row,
                ...buildAccountListGoal(row),
            }
        });
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadBillToAccountList()", err.message);
            return Promise.reject(err);
        }
        debug("loadBillToAccountList()", err);
        return Promise.reject(new Error('Error in loadBillToAccountList()'));
    }
}
