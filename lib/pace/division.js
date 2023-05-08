import Debug from 'debug'
import {mysql2Pool} from "chums-local-modules";
import {getDates} from "./utils.js";


// import Debug from 'debug';
// import {loadInvoiced, loadCurrentInvoices} from './invoices.js';
// import {loadHeldOrders, loadOpenOrders, loadPreviousOpenOrders} from './orders.js';
// import {loadCustomerTypes} from './customertype.js';
const debug = Debug('chums:api:sales:pace:division');

/**
 *
 * @param {string} company
 * @param {string} year
 * @param {string} month
 * @return {Promise<DivisionPaceRow[]>}
 */
export async function loadPaceByDivision({company, year, month}) {
    try {
        const {minDate, maxDate} = getDates({year, month});
        const sql = `
            SELECT d.ARDivisionNo,
                   d.ARDivisionDesc,
                   budget.budget,
                   budget.goal,
                   IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0)    AS InvoiceTotal,
                   IFNULL(prevOpen.PrevOrderTotal, 0)                                    AS PrevOpenOrderTotal,
                   IFNULL(open.OpenOrderTotal, 0)                                        AS OpenOrderTotal,
                   IFNULL(held.HeldOrderTotal, 0)                                        AS HeldOrderTotal,
                   IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0) +
                   IFNULL(prevOpen.PrevOrderTotal, 0)
                       + IFNULL(open.OpenOrderTotal, 0) + IFNULL(held.HeldOrderTotal, 0) as Pace
            FROM c2.ar_division d
                     LEFT JOIN (SELECT a.Company,
                                       SUBSTR(a.Account, 9, 2)                               AS SubAcct,
                                       SUM(IF(b.BudgetCode = 'ORIGINAL', b.CreditAmount, 0)) AS budget,
                                       SUM(IF(b.BudgetCode = 'REVISED', b.CreditAmount, 0))  AS goal
                                FROM c2.gl_account a
                                         INNER JOIN c2.gl_periodbudgetdetail b
                                                    ON b.Company = a.Company AND b.AccountKey = a.AccountKey
                                WHERE a.Company = :company
                                  AND a.Account LIKE '42__-02-%'
                                  AND b.FiscalYear = :year
                                  AND b.FiscalPeriod = :month
                                GROUP BY SUBSTR(a.Account, 9, 2)) budget
                               ON budget.Company = d.Company AND budget.SubAcct = d.PostSalesToGLSubAcct
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
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
                                         c.ARDivisionNo) invoiced
                               ON invoiced.Company = d.Company AND invoiced.ARDivisionNo = d.ARDivisionNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       SUM(ih.TaxableAmt + ih.NonTaxableAmt - ih.DiscountAmt) AS InvoiceTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_InvoiceHeader ih
                                                    ON ih.Company = c.Company AND ih.ARDivisionNo = c.ARDivisionNo AND
                                                       ih.CustomerNo = c.CustomerNo
                                WHERE c.Company = :company
                                  AND ih.InvoiceType <> 'XD'
                                  AND ih.InvoiceDate BETWEEN :minDate AND :maxDate
                                GROUP BY c.Company, c.ARDivisionNo) current
                               ON current.Company = d.Company AND current.ARDivisionNo = d.ARDivisionNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
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
                                GROUP BY c.Company, c.ARDivisionNo) prevOpen
                               ON prevOpen.Company = d.Company AND prevOpen.ARDivisionNo = d.ARDivisionNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
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
                                GROUP BY c.Company, c.ARDivisionNo) open
                               ON open.Company = d.Company AND open.ARDivisionNo = d.ARDivisionNo
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt) AS HeldOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                WHERE c.Company = :company
                                  AND oh.ShipExpireDate BETWEEN :minDate AND :maxDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND (oh.OrderStatus = 'H'
                                    OR c.CreditHold = 'Y')
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo) held
                               ON held.Company = d.Company AND held.ARDivisionNo = d.ARDivisionNo

            WHERE d.Company = :company
        `;
        const args = {company, year, month, minDate, maxDate}
        const [rows] = await mysql2Pool.query(sql, args);
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadDivisionPace()", err.message);
            return Promise.reject(err);
        }
        debug("loadDivisionPace()", err);
        return Promise.reject(new Error('Error in loadDivisionPace()'));
    }
}

