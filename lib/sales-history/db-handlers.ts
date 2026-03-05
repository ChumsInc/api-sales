import {mysql2Pool} from "chums-local-modules";
import dayjs from "dayjs";
import {MonthHistoryRow, MonthOpenTotalRow} from "./sales-history-types.js";
import Debug from "debug";

const debug = Debug('chums:lib:sales:sales-history:db-handlers');


export async function loadMonthHistory(userId: number) {
    try {
        const year0 = dayjs().startOf('year');
        const query = `SELECT MONTH(h.InvoiceDate) AS month,
                              SUM(IF(YEAR(h.InvoiceDate) = :year0,
                                     h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt,
                                     NULL)
                              )                    AS year0,
                              SUM(IF(YEAR(h.InvoiceDate) = :year1,
                                     h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt,
                                     0
                                  )
                              )                    AS year1,
                              SUM(IF(YEAR(h.InvoiceDate) = :year2,
                                     h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt,
                                     0
                                  )
                              )                    AS year2
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, '' AS ShipToCode
                             FROM users.user_AR_Customer
                             WHERE userId = :userId
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_SO_ShipToAddress
                             WHERE userId = :userId
                             ) ac
                                INNER JOIN c2.ar_invoicehistoryheader h
                                           ON h.Company = ac.Company AND 
                                              h.ARDivisionNo = ac.ardivisionno AND
                                              h.CustomerNo = ac.CustomerNo AND 
                                              ifnull(h.ShipToCode, '') = ac.ShipToCode
                       WHERE YEAR(h.InvoiceDate) BETWEEN :year2 AND :year0
                       GROUP BY month`;
        const data = {
            userId,
            year0: year0.format('YYYY'),
            year1: year0.subtract(1, 'year').format('YYYY'),
            year2: year0.subtract(2, 'year').format('YYYY')
        };
        const [rows] = await mysql2Pool.query<MonthHistoryRow[]>(query, data);
        return rows.map(row => ({
            ...row,
            month: `${row.month}`.padStart(2, '0')
        }));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadMonthHistory()", err.message);
            return Promise.reject(err);
        }
        debug("loadMonthHistory()", err);
        return Promise.reject(new Error('Error in loadMonthHistory()'));
    }
}


export async function loadMonthOpen(userId: number) {
    try {
        const query = `SELECT MONTH(IF(h.ShipExpireDate < NOW(),
                                       NOW(),
                                       h.ShipExpireDate)
                              )                 AS month,
                              SUM(h.OrderTotal) AS openTotal
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, NULL AS ShipToCode
                             FROM users.user_AR_Customer
                             WHERE userId = :userId
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_SO_ShipToAddress
                             WHERE userId = :userId) ac
                                INNER JOIN c2.SO_SalesOrderHeader h
                                           ON h.Company = ac.Company AND 
                                              h.ARDivisionNo = ac.ardivisionno AND
                                              h.CustomerNo = ac.CustomerNo AND
                                              IFNULL(h.ShipToCode, '') = IFNULL(ac.ShipToCode, '')
                       WHERE h.Company = 'chums'
                         AND YEAR(h.ShipExpireDate) = :year
                         AND OrderType IN ('S', 'B')
                       GROUP BY month`;
        const data = {
            userId,
            year: dayjs().startOf('year').format('YYYY'),
        };
        const [rows] = await mysql2Pool.query<MonthOpenTotalRow[]>(query, data);
        return rows.map(row => ({
            ...row,
            month: `${row.month}`.padStart(2, '0')
        }))
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadMonthOpen()", err.message);
            return Promise.reject(err);
        }
        debug("loadMonthOpen()", err);
        return Promise.reject(new Error('Error in loadMonthOpen()'));
    }
}
