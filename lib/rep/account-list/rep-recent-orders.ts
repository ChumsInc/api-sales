import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import type {RepRecentOrder} from "./account-list-types.js";
import type {RowDataPacket} from "mysql2";

const debug = Debug('chums:lib:rep:rep-recent-orders');

type RepRecentOrderRow = RepRecentOrder & RowDataPacket;

export interface LoadRecentOrdersProps {
    userId: number;
    salespersonNo?: string;
}

export async function loadRecentOrders({userId, salespersonNo}: LoadRecentOrdersProps): Promise<RepRecentOrder[]> {
    try {
        const sql = `SELECT h.SalesOrderNo,
                            h.SalespersonDivisionNo,
                            h.SalespersonNo,
                            h.OrderDate,
                            h.OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.ShipToCode,
                            h.BillToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToCountryCode,
                            ih.InvoiceNo,
                            ih.InvoiceDate,
                            ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt AS InvoiceTotal,
                            h.UDF_IMPRINTED                                             AS Imprinted,
                            IF(ISNULL(b2b.id), 'N', 'Y')                                AS B2BOrder
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                           FROM users.user_AR_Customer
                           WHERE userid = :userId
                             AND (IFNULL(:salespersonNo, '') = '' OR salespersonNo = :salespersonNo)) ac
                              INNER JOIN c2.SO_SalesOrderHistoryHeader h
                                         ON h.Company = ac.Company AND h.ARDivisionNo = ac.ARDivisionNo AND
                                            h.CustomerNo = ac.CustomerNo
                              LEFT JOIN c2.ar_invoicehistoryheader ih
                                        ON ih.Company = h.Company AND ih.SalesOrderNo = h.SalesOrderNo
                              LEFT JOIN b2b.SalesOrderLog b2b
                                        ON b2b.Company = c2.sage_company(h.Company) AND
                                           b2b.SalesOrderNo = h.SalesOrderNo
                     WHERE h.Company = 'chums'
                       AND h.ShipToCode IS NULL
                       AND (h.OrderDate >= DATE_ADD(NOW(), INTERVAL -6 WEEK) OR
                            ih.InvoiceDate >= DATE_ADD(NOW(), INTERVAL -6 WEEK))
                       AND h.OrderStatus NOT IN ('X', 'Q', 'A')

                     UNION

                     SELECT h.SalesOrderNo,
                            h.SalespersonDivisionNo,
                            h.SalespersonNo,
                            h.OrderDate,
                            h.OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.ShipToCode,
                            h.BillToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToCountryCode,
                            ih.InvoiceNo,
                            ih.InvoiceDate,
                            ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt AS InvoiceTotal,
                            h.UDF_IMPRINTED                                             AS Imprinted,
                            IF(ISNULL(b2b.id), 'N', 'Y')                                AS B2BOrder
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                           FROM users.user_SO_ShipToAddress
                           WHERE userid = :userId
                             AND (IFNULL(:salespersonNo, '') = '' OR salespersonNo = :salespersonNo)) ac
                              INNER JOIN c2.SO_SalesOrderHistoryHeader h
                                         ON h.Company = ac.Company AND h.ARDivisionNo = ac.ARDivisionNo AND
                                            h.CustomerNo = ac.CustomerNo AND h.ShipToCode = ac.ShipToCode
                              LEFT JOIN c2.ar_invoicehistoryheader ih
                                        ON ih.Company = h.Company AND ih.SalesOrderNo = h.SalesOrderNo
                              LEFT JOIN b2b.SalesOrderLog b2b
                                        ON b2b.Company = c2.sage_company(h.Company) AND
                                           b2b.SalesOrderNo = h.SalesOrderNo
                     WHERE h.Company = 'chums'
                       AND (h.OrderDate >= DATE_ADD(NOW(), INTERVAL -6 WEEK) OR
                            ih.InvoiceDate >= DATE_ADD(NOW(), INTERVAL -6 WEEK))
                       AND h.OrderStatus NOT IN ('X', 'Q', 'A')

                     ORDER BY OrderDate, SalesOrderNo`;
        const args = {userId, salespersonNo};
        const [rows] = await mysql2Pool.query<RepRecentOrderRow[]>(sql, args);
        return rows;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadRecentOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadRecentOrders()", err);
        return Promise.reject(new Error('Error in loadRecentOrders()'));
    }
}
