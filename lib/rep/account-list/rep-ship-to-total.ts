import {mysql2Pool} from "chums-local-modules";
import {buildAccountListGoal, getAccountListDates} from "./utils.js";
import type {AccountListProps, RepAccountListTotal} from "./account-list-types.js";
import type {RowDataPacket} from "mysql2";
import Debug from "debug";

const debug = Debug('chums:lib:rep:account-list:rep-ship-to-total');

type ShipToTotalRow = RowDataPacket & Omit<RepAccountListTotal, 'YTDTotal' | 'pctChange' | 'CYGoal'>

export async function loadRepShipToTotal({userId, asOfDate}: Omit<AccountListProps, 'salespersonNo'>): Promise<RepAccountListTotal[]> {
    try {
        const {CYCurrDate} = getAccountListDates(asOfDate);
        const sql = `SELECT sta.SalespersonDivisionNo,
                            sta.SalespersonNo,
                            rep.SalespersonName,
                            IF(ISNULL(rep.SalespersonNo), 'Y', IFNULL(rep.UDF_TERMINATED, 'N')) AS TerminatedRep,
                            COUNT(DISTINCT sta.Company, sta.ARDivisionNo, sta.CustomerNo)       AS Customers,
                            SUM(IFNULL(InvCY.InvCYTD, 0))                                       AS InvCYTD,
                            SUM(IFNULL(OpenCY.total, 0))                                        AS OpenOrders,
                            SUM(IFNULL(InvPYTD.total, 0))                                       AS InvPYTD,
                            SUM(IFNULL(InvPYr.total, 0))                                        AS InvPYr
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                           FROM users.user_SO_ShipToAddress
                           WHERE userid = :userId) ac
                              INNER JOIN c2.SO_ShipToAddress sta
                                         ON sta.Company = ac.Company AND
                                            sta.ARDivisionNo = ac.ARDivisionNo AND
                                            sta.CustomerNo = ac.CustomerNo AND
                                            sta.ShipToCode = ac.ShipToCode
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = sta.Company
                                             AND c.ARDivisionNo = sta.ARDivisionNo
                                             AND c.CustomerNo = sta.CustomerNo
                              LEFT JOIN c2.ar_salesperson rep
                                        ON rep.Company = sta.Company
                                            AND rep.SalespersonDivisionNo = sta.SalespersonDivisionNo
                                            AND rep.SalespersonNo = sta.SalespersonNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvCYTD
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(:CYCurrDate)
                                           AND InvoiceDate <= :CYCurrDate
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvCY
                                        ON InvCY.Company = sta.Company AND
                                           InvCY.ARDivisionNo = sta.ARDivisionNo AND
                                           InvCY.CustomerNo = sta.CustomerNo AND
                                           InvCY.ShipToCode = sta.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) OpenCY
                                        ON OpenCY.Company = sta.Company
                                            AND OpenCY.ARDivisionNo = sta.ARDivisionNo
                                            AND OpenCY.CustomerNo = sta.CustomerNo
                                            AND OpenCY.ShipToCode = sta.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYTD
                                        ON InvPYTD.Company = sta.Company
                                            AND InvPYTD.ARDivisionNo = sta.ARDivisionNo
                                            AND InvPYTD.CustomerNo = sta.CustomerNo
                                            AND InvPYTD.ShipToCode = sta.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYr
                                        ON InvPYr.Company = sta.Company
                                            AND InvPYr.ARDivisionNo = sta.ARDivisionNo
                                            AND InvPYr.CustomerNo = sta.CustomerNo
                                            AND InvPYr.ShipToCode = sta.ShipToCode
                     WHERE sta.Company = 'chums'
                       AND c.CustomerStatus = 'A'
                       AND sta.ARDivisionNo NOT IN ('00', '10')
                       AND c.SalespersonNo <> sta.SalespersonNo
                     GROUP BY sta.Company, sta.SalespersonDivisionNo, sta.SalespersonNo
                     ORDER BY sta.Company, sta.SalespersonDivisionNo, sta.SalespersonNo`;
        const args = {userId, CYCurrDate};
        const [rows] = await mysql2Pool.query<ShipToTotalRow[]>(sql, args);
        return rows.map(row => {
            return {
                ...row,
                ...buildAccountListGoal(row),
            }
        });
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadRepShipToTotal()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepShipToTotal()", err);
        return Promise.reject(new Error('Error in loadRepShipToTotal()'));
    }
}
