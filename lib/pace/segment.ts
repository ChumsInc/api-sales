import Debug from 'debug'
import {mysql2Pool} from "chums-local-modules";
import {getDates} from "./utils.js"
import {PaceDivisionRow, PaceParams, PaceSegmentRow} from "./pace-types.js";
import {RowDataPacket} from "mysql2";

const debug = Debug('chums:api:sales:pace:segment');

export interface LoadPaceBySegmentProps extends PaceParams {
    ARDivisionNo: string;
}
export async function loadPaceBySegment({year, month, ARDivisionNo}: LoadPaceBySegmentProps): Promise<PaceSegmentRow[]> {
    try {
        const {minDate, maxDate} = getDates({year, month});
        const sql = `
            SELECT d.ARDivisionNo,
                   d.Segment,
                   d.Description,
                   d.Customers,
                   IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0)    AS InvoiceTotal,
                   IFNULL(prevOpen.PrevOrderTotal, 0)                                    AS PrevOpenOrderTotal,
                   IFNULL(open.OpenOrderTotal, 0)                                        AS OpenOrderTotal,
                   IFNULL(held.HeldOrderTotal, 0)                                        AS HeldOrderTotal,
                   IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0) +
                   IFNULL(prevOpen.PrevOrderTotal, 0)
                       + IFNULL(open.OpenOrderTotal, 0) + IFNULL(held.HeldOrderTotal, 0) AS Pace
            FROM (SELECT c.Company,
                         c.ARDivisionNo,
                         IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')                            AS Segment,
                         (SELECT Description
                          FROM c2.AR_CustomerType ctt
                          WHERE ctt.CustomerType =
                                IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE'))                    AS Description,
                         COUNT(*)                                                                           AS Customers
                  FROM c2.ar_customer c
                           LEFT JOIN c2.AR_CustomerType ct
                                     ON ct.CustomerType = c.CustomerType
                  WHERE c.CustomerStatus = 'A'
                    AND c.Company = 'chums'
                    AND c.ARDivisionNo NOT IN ('00', '10')
                  GROUP BY ARDivisionNo, IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')) d
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')          AS Segment,
                                       SUM(ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt) AS InvoiceTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.ar_invoicehistoryheader ih
                                                    ON ih.Company = c.Company
                                                        AND ih.ARDivisionNo = c.ARDivisionNo AND
                                                       ih.CustomerNo = c.CustomerNo
                                         LEFT JOIN c2.AR_CustomerType ct
                                                   ON ct.CustomerType = IFNULL(NULLIF(c.CustomerType, ''), 'NONE')
                                WHERE c.Company = 'chums'
                                  AND ih.InvoiceType <> 'XD'
                                  AND ih.InvoiceDate BETWEEN :minDate AND :maxDate
                                GROUP BY c.Company,
                                         c.ARDivisionNo,
                                         IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')) invoiced
                               ON invoiced.Company = d.Company AND invoiced.ARDivisionNo = d.ARDivisionNo
                                   AND invoiced.Segment = d.Segment
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE') AS Segment,
                                       SUM(ih.TaxableAmt + ih.NonTaxableAmt - ih.DiscountAmt)  AS InvoiceTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_InvoiceHeader ih
                                                    ON ih.Company = c.Company AND ih.ARDivisionNo = c.ARDivisionNo AND
                                                       ih.CustomerNo = c.CustomerNo
                                         LEFT JOIN c2.AR_CustomerType ct
                                                   ON ct.CustomerType = IFNULL(NULLIF(c.CustomerType, ''), 'NONE')

                                WHERE c.Company = 'chums'
                                  AND ih.InvoiceType <> 'XD'
                                  AND ih.InvoiceDate BETWEEN :minDate AND :maxDate
                                GROUP BY c.Company, c.ARDivisionNo,
                                         IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')) current
                               ON current.Company = d.Company AND current.ARDivisionNo = d.ARDivisionNo
                                   AND current.Segment = d.Segment
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE') AS Segment,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt)  AS PrevOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                         LEFT JOIN c2.AR_CustomerType ct
                                                   ON ct.CustomerType = IFNULL(NULLIF(c.CustomerType, ''), 'NONE')

                                WHERE c.Company = 'chums'
                                  AND oh.ShipExpireDate < :minDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND oh.OrderStatus <> 'H'
                                  AND c.CreditHold <> 'Y'
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo,
                                         IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')) prevOpen
                               ON prevOpen.Company = d.Company AND prevOpen.ARDivisionNo = d.ARDivisionNo
                                   AND prevOpen.Segment = d.Segment
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE') AS Segment,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt)  AS OpenOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                         LEFT JOIN c2.AR_CustomerType ct
                                                   ON ct.CustomerType = IFNULL(NULLIF(c.CustomerType, ''), 'NONE')

                                WHERE c.Company = 'chums'
                                  AND oh.ShipExpireDate BETWEEN :minDate AND :maxDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND oh.OrderStatus <> 'H'
                                  AND c.CreditHold <> 'Y'
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo,
                                         IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')) open
                               ON open.Company = d.Company
                                   AND open.ARDivisionNo = d.ARDivisionNo
                                   AND open.Segment = d.Segment
                     LEFT JOIN (SELECT c.Company,
                                       c.ARDivisionNo,
                                       IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), '')    AS Segment,
                                       SUM(oh.TaxableAmt + oh.NonTaxableAmt - oh.DiscountAmt) AS HeldOrderTotal
                                FROM c2.ar_customer c
                                         INNER JOIN c2.SO_SalesOrderHeader oh
                                                    ON oh.Company = c.Company AND oh.ARDivisionNo = c.ARDivisionNo AND
                                                       oh.CustomerNo = c.CustomerNo
                                         LEFT JOIN c2.AR_CustomerType ct
                                                   ON ct.CustomerType = IFNULL(NULLIF(c.CustomerType, ''), 'NONE')

                                WHERE c.Company = 'chums'
                                  AND oh.ShipExpireDate BETWEEN :minDate AND :maxDate
                                  AND oh.OrderType NOT IN ('Q', 'M')
                                  AND (oh.OrderStatus = 'H'
                                    OR c.CreditHold = 'Y')
                                  AND oh.CurrentInvoiceNo IS NULL
                                GROUP BY c.Company, c.ARDivisionNo,
                                         IFNULL(IFNULL(ct.ReportAsType, c.CustomerType), 'NONE')) held
                               ON held.Company = d.Company AND held.ARDivisionNo = d.ARDivisionNo AND
                                  held.Segment = d.Segment

            WHERE d.Company = 'chums'
              AND d.ARDivisionNo LIKE :ARDivisionNo
              AND NOT (ISNULL(invoiced.InvoiceTotal)
                AND ISNULL(current.InvoiceTotal)
                AND ISNULL(prevOpen.PrevOrderTotal)
                AND ISNULL(open.OpenOrderTotal)
                AND ISNULL(held.HeldOrderTotal)
                )
            ORDER BY d.ARDivisionNo,
                     IFNULL(prevOpen.PrevOrderTotal, 0) DESC,
                     IFNULL(open.OpenOrderTotal, 0) DESC,
                     (IFNULL(invoiced.InvoiceTotal, 0) + IFNULL(current.InvoiceTotal, 0)) DESC
        `;
        const args = {year, month, minDate, maxDate, ARDivisionNo}
        const [rows] = await mysql2Pool.query<(PaceSegmentRow & RowDataPacket)[]>(sql, args);
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



const sqlCustomerTypes = `
    SELECT ct.CustomerType, ctt.ReportAsType, ctt.Description, COUNT(c.ARDivisionNo) AS customerCount
    FROM (
             SELECT CustomerType
             FROM c2.AR_CustomerType
             UNION
             SELECT DISTINCT CustomerType
             FROM c2.ar_customer
             WHERE Company = 'chums'
               AND CustomerStatus = 'A'
             ) ct
         LEFT JOIN c2.AR_CustomerType ctt
                   ON ctt.CustomerType = ct.CustomerType
         LEFT JOIN c2.ar_customer c
                   ON c.CustomerType = ct.CustomerType AND c.Company = 'chums' AND c.CustomerStatus = 'A'
    GROUP BY ct.CustomerType`;
