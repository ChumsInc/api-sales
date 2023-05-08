import Debug from 'debug'
import {mysql2Pool} from "chums-local-modules";
import {getDates} from "./utils.js";


// import Debug from 'debug';
const debug = Debug('chums:api:sales:pace:division');

/**
 *
 * @param {string} company
 * @param {string} year
 * @param {string} month
 * @param {string} ARDivisionNo
 * @return {Promise<void>}
 */
export async function loadPaceByCustomer({company, year, month, ARDivisionNo}) {
    try {
        debug('loadPaceByCustomer()', {company, year, month, ARDivisionNo});
        const sql = `
            SELECT d.ARDivisionNo,
                   d.CustomerNo,
                   d.CustomerName,
                   IFNULL(IFNULL(ct.ReportAsType, nullif(d.CustomerType, '')), 'NONE')   as Segment,
                   IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0)    AS InvoiceTotal,
                   IFNULL(prevOpen.PrevOrderTotal, 0)                                    AS PrevOpenOrderTotal,
                   IFNULL(open.OpenOrderTotal, 0)                                        AS OpenOrderTotal,
                   IFNULL(held.HeldOrderTotal, 0)                                        AS HeldOrderTotal,
                   IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0) +
                   IFNULL(prevOpen.PrevOrderTotal, 0)
                       + IFNULL(open.OpenOrderTotal, 0) + IFNULL(held.HeldOrderTotal, 0) as Pace
            FROM c2.ar_customer d
                     LEFT JOIN c2.AR_CustomerType ct
                               ON ct.CustomerType = d.CustomerType
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       c.CustomerNo,
                                       SUM(ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt) AS InvoiceTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.ar_invoicehistoryheader ih
                                                    ON ih.Company = c.Company
                                                        AND ih.ARDivisionNo = c.ARDivisionNo AND
                                                       ih.CustomerNo = c.CustomerNo
                                WHERE c.Company = :company
                                  AND ih.InvoiceType <> 'XD'
                                  AND ih.InvoiceDate BETWEEN :minDate AND :maxDate
                                GROUP BY c.Company,
                                         c.ARDivisionNo,
                                         c.CustomerNo) invoiced
                               ON invoiced.Company = d.Company
                                   AND invoiced.ARDivisionNo = d.ARDivisionNo
                                   AND invoiced.CustomerNo = d.CustomerNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       c.CustomerNo,
                                       SUM(ih.TaxableAmt + ih.NonTaxableAmt - ih.DiscountAmt) AS InvoiceTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_InvoiceHeader ih
                                                    ON ih.Company = c.Company AND ih.ARDivisionNo = c.ARDivisionNo AND
                                                       ih.CustomerNo = c.CustomerNo
                                WHERE c.Company = :company
                                  AND ih.InvoiceType <> 'XD'
                                  AND ih.InvoiceDate BETWEEN :minDate AND :maxDate
                                GROUP BY c.Company, c.ARDivisionNo, c.CustomerNo) current
                               ON current.Company = d.Company
                                   AND current.ARDivisionNo = d.ARDivisionNo
                                   AND current.CustomerNo = d.CustomerNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       c.CustomerNo,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt) AS PrevOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                WHERE c.Company = :company
                                  AND oh.ShipExpireDate < :minDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND oh.OrderStatus <> 'H'
                                  AND c.CreditHold <> 'Y'
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo, c.CustomerNo) prevOpen
                               ON prevOpen.Company = d.Company
                                   AND prevOpen.ARDivisionNo = d.ARDivisionNo
                                   AND prevOpen.CustomerNo = d.CustomerNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       c.CustomerNo,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt) AS OpenOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                WHERE c.Company = :company
                                  AND oh.ShipExpireDate BETWEEN :minDate AND :maxDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND oh.OrderStatus <> 'H'
                                  AND c.CreditHold <> 'Y'
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo, c.CustomerNo) open
                               ON open.Company = d.Company
                                   AND open.ARDivisionNo = d.ARDivisionNo
                                   AND open.CustomerNo = d.CustomerNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       c.CustomerNo,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt) AS HeldOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                         LEFT JOIN c2.AR_CustomerType ct
                                                   ON ct.CustomerType = IFNULL(ct.ReportAsType, c.CustomerType)

                                WHERE c.Company = :company
                                  AND oh.ShipExpireDate BETWEEN :minDate AND :maxDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND (oh.OrderStatus = 'H'
                                    OR c.CreditHold = 'Y')
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo, c.CustomerNo) held
                               ON held.Company = d.Company
                                   AND held.ARDivisionNo = d.ARDivisionNo AND
                                  held.CustomerNo = d.CustomerNo

            WHERE d.Company = :company
              AND d.ARDivisionNo LIKE :ARDivisionNo
              AND NOT (ISNULL(invoiced.InvoiceTotal)
                AND ISNULL(current.InvoiceTotal)
                AND ISNULL(prevOpen.PrevOrderTotal)
                AND ISNULL(open.OpenOrderTotal)
                AND ISNULL(held.HeldOrderTotal)
                )
            ORDER BY IFNULL(prevOpen.PrevOrderTotal, 0) DESC,
                     IFNULL(open.OpenOrderTotal, 0) DESC,
                     (IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0)) DESC,
                     ARDivisionNo, CustomerNo
        `;
        const {minDate, maxDate} = getDates({year, month});
        const [rows] = await mysql2Pool.query(sql, {company, minDate, maxDate, ARDivisionNo});
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadPaceByCustomer()", err.message);
            return Promise.reject(err);
        }
        debug("loadPaceByCustomer()", err);
        return Promise.reject(new Error('Error in loadPaceByCustomer()'));
    }
}

