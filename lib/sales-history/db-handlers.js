import { mysql2Pool } from "chums-local-modules";
import dayjs from "dayjs";
import Debug from "debug";
const debug = Debug('chums:lib:sales:sales-history:db-handlers');
export async function loadMonthHistory(userId) {
    try {
        const year0 = dayjs().startOf('year');
        const query = `SELECT MONTH(h.InvoiceDate) AS month,
                              SUM(IF(YEAR(h.InvoiceDate) = YEAR(:year0),
                                     h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt,
                                     NULL)
                              )                    AS year0,
                              SUM(IF(YEAR(h.InvoiceDate) = YEAR(:year1),
                                     h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt,
                                     0
                                  )
                              )                    AS year1,
                              SUM(IF(YEAR(h.InvoiceDate) = YEAR(:year2),
                                     h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt,
                                     0
                                  )
                              )                    AS year2
                       FROM c2.ar_division d
                                INNER JOIN c2.ar_invoicehistoryheader h
                                           ON h.Company = d.Company AND h.ARDivisionNo = d.ardivisionno
                                INNER JOIN users.accounts a
                                           ON h.company = a.Company
                                               AND (
                                                  (h.SalespersonDivisionNo LIKE a.SalespersonDivisionNo AND
                                                   h.SalespersonNo LIKE a.SalespersonNo)
                                                      OR
                                                  (h.ARDivisionNo LIKE a.ARDivisionNo AND h.CustomerNo LIKE a.CustomerNo)
                                                  )
                       WHERE a.userid = :userId
                         AND h.Company = 'chums'
                         AND YEAR(h.InvoiceDate) BETWEEN YEAR(:year2) AND YEAR(:year0)
                       GROUP BY month`;
        const data = {
            userId,
            year0: year0.format('YYYY-MM-DD'),
            year1: year0.subtract(1, 'year').format('YYYY-MM-DD'),
            year2: year0.subtract(2, 'year').format('YYYY-MM-DD')
        };
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => ({
            ...row,
            month: `${row.month}`.padStart(2, '0')
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadMonthHistory()", err.message);
            return Promise.reject(err);
        }
        debug("loadMonthHistory()", err);
        return Promise.reject(new Error('Error in loadMonthHistory()'));
    }
}
export async function loadMonthOpen(userId) {
    try {
        const query = `SELECT MONTH(IF(h.ShipExpireDate < NOW(),
                                       NOW(),
                                       h.ShipExpireDate)
                              )                 AS month,
                              SUM(h.OrderTotal) AS openTotal
                       FROM c2.SO_SalesOrderHeader h
                                INNER JOIN users.accounts a
                                           ON h.company = a.Company
                                               AND (
                                                  (h.SalespersonDivisionNo LIKE a.SalespersonDivisionNo AND
                                                   h.SalespersonNo LIKE a.SalespersonNo)
                                                      OR
                                                  (h.ARDivisionNo LIKE a.ARDivisionNo AND h.CustomerNo LIKE a.CustomerNo)
                                                  )
                       WHERE h.Company = 'chums'
                         AND a.userid = :userId
                         AND YEAR(h.ShipExpireDate) = :year
                         AND OrderType IN ('S', 'B')
                       GROUP BY month`;
        const data = {
            userId,
            year: dayjs().startOf('year').format('YYYY'),
        };
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => ({
            ...row,
            month: `${row.month}`.padStart(2, '0')
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadMonthOpen()", err.message);
            return Promise.reject(err);
        }
        debug("loadMonthOpen()", err);
        return Promise.reject(new Error('Error in loadMonthOpen()'));
    }
}
