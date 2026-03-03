import {mysql2Pool} from "chums-local-modules";
import {buildAccountListGoal, getAccountListDates} from "./utils.js";
import type {RowDataPacket} from "mysql2";
import type {AccountListProps, RepAccountWithSales} from "./account-list-types.js";
import Debug from "debug";

const debug = Debug('chums:lib:rep:account-list:bill-to-account-list');

type RepAccountWithSalesRow =
    RowDataPacket
    & Omit<RepAccountWithSales, 'YTDTotal' | 'pctChange' | 'CYGoal' | 'YTDGoalPct'>;

export async function loadShipToAccountList({userId, salespersonNo, asOfDate}: AccountListProps): Promise<RepAccountWithSales[]> {
    try {
        const {CYCurrDate} = getAccountListDates(asOfDate);
        const sql = `SELECT c.ARDivisionNo,
                            c.CustomerNo,
                            c.CustomerName,
                            sta.ShipToCode,
                            sta.ShipToName,
                            CONCAT_WS(', ', c.city, c.state, c.zipcode) AS CityStateZip,
                            c.ZipCode,
                            c.DateLastActivity,
                            sta.SalespersonDivisionNo,
                            sta.SalespersonNo,
                            rep.SalespersonName,
                            IFNULL(InvCY.InvCYTD, 0)                    AS InvCYTD,
                            IFNULL(OpenCY.total, 0)                     AS OpenOrders,
                            IFNULL(InvPYTD.total, 0)                    AS InvPYTD,
                            IFNULL(InvPYr.total, 0)                     AS InvPYr
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                           FROM users.user_SO_ShipToAddress
                           WHERE userid = :userId) ac
                              INNER JOIN c2.SO_ShipToAddress sta
                                         ON sta.Company = ac.Company AND 
                                            sta.ARDivisionNo = ac.ARDivisionNo AND
                                            sta.CustomerNo = ac.CustomerNo AND 
                                            sta.ShipToCode = ac.ShipToCode
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = ac.Company AND
                                            c.ARDivisionNo = ac.ARDivisionNo AND
                                            c.CustomerNo = ac.CustomerNo
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
                                        ON InvCY.Company = ac.Company
                                            AND InvCY.ARDivisionNo = ac.ARDivisionNo
                                            AND InvCY.CustomerNo = ac.CustomerNo
                                            AND InvCY.ShipToCode = ac.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) OpenCY
                                        ON OpenCY.Company = c.Company
                                            AND OpenCY.ARDivisionNo = ac.ARDivisionNo
                                            AND OpenCY.CustomerNo = ac.CustomerNo
                                            AND OpenCY.ShipToCode = ac.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYTD
                                        ON InvPYTD.Company = ac.Company
                                            AND InvPYTD.ARDivisionNo = ac.ARDivisionNo
                                            AND InvPYTD.CustomerNo = ac.CustomerNo
                                            AND InvPYTD.ShipToCode = ac.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYr
                                        ON InvPYr.Company = ac.Company
                                            AND InvPYr.ARDivisionNo = ac.ARDivisionNo
                                            AND InvPYr.CustomerNo = ac.CustomerNo
                                            AND InvPYr.ShipToCode = ac.ShipToCode
                     WHERE c.Company = 'chums'
                       AND c.CustomerStatus = 'A'
                       AND (IFNULL(:salespersonNo, '') = '' OR sta.SalespersonNo = :salespersonNo)
                       AND c.ARDivisionNo NOT IN ('00', '10')
                     AND c.SalespersonNo <> sta.SalespersonNo
                     ORDER BY ARDivisionNo, CustomerNo, ShipToCode`;
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
