import {CustomerRow, LoadRepPaceProps, LoadRepProps} from "./types.js";
import {mysql2Pool} from "chums-local-modules";
import {RowDataPacket} from "mysql2";
import {Decimal} from "decimal.js";
import Debug from "debug";
import {calcGrowthRate, calcPace} from "./utils.js";

const debug = Debug('chums:lib:rep:pace:rep-customers');

const managedCustomersSQL = `
    SELECT t.Company,
           :SalespersonDivisionNo                   AS SalespersonDivisionNo,
           :SalespersonNo                           AS SalespersonNo,
           IF(:groupByCustomer, t.ARDivisionNo, '') AS ARDivisionNo,
           IF(:groupByCustomer, t.CustomerNo, '')   AS CustomerNo,
           IF(:groupByCustomer, t.ShipToCode, '')   AS ShipToCode,
           IF(:groupByCustomer, t.CustomerName, '') AS CustomerName,
           IF(:groupByCustomer, t.EmailAddress, '') AS EmailAddress,
           SUM(t.OpenOrders)                        AS OpenOrders,
           SUM(t.InvCYTD)                           AS InvCYTD,
           SUM(t.InvPYTD)                           AS InvPYTD,
           SUM(t.InvPY)                             AS InvPY,
           SUM(t.InvP2TD)                           AS InvP2TD,
           SUM(t.InvP2)                             AS InvP2
    FROM (SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 ''         AS ShipToCode,
                 c.CustomerName,
                 c.EmailAddress,
                 0          AS OpenOrders,
                 SUM(IF(h.InvoiceDate BETWEEN :minDate AND :maxDate,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvCYTD,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 1 YEAR) AND SUBDATE(:maxDate, INTERVAL 1 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvPYTD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 1,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvPY,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 2 YEAR) AND SUBDATE(:maxDate, INTERVAL 2 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvP2TD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 2,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.ar_invoicehistoryheader h
                              USING (Company, ARDivisionNo, CustomerNo)
                   LEFT JOIN c2.SO_ShipToAddress s USING (Company, ARDivisionNo, CustomerNo, ShipToCode)

          WHERE h.Company = :Company
            AND c.SalespersonDivisionNo = :SalespersonDivisionNo
            AND c.SalespersonNo = :SalespersonNo
            AND IFNULL(s.SalespersonDivisionNo, c.SalespersonDivisionNo) = c.SalespersonDivisionNo
            AND IFNULL(s.SalespersonNo, c.SalespersonNo) = c.SalespersonNo
            AND (
              h.InvoiceDate BETWEEN :minDate AND :maxDate
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 1
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 2
              )
            AND h.InvoiceType <> 'XD'
          GROUP BY Company, ARDivisionNo, CustomerNo

          UNION

          SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 IFNULL(s.ShipToCode, '') AS ShipToCode,
                 s.ShipToName,
                 s.EmailAddress,
                 0                        AS OpenOrders,
                 SUM(IF(h.InvoiceDate BETWEEN :minDate AND :maxDate,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvCYTD,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 1 YEAR) AND SUBDATE(:maxDate, INTERVAL 1 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvPYTD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 1,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvPY,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 2 YEAR) AND SUBDATE(:maxDate, INTERVAL 2 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvP2TD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 2,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.SO_ShipToAddress s
                              USING (Company, ARDivisionNo, CustomerNo)
                   INNER JOIN c2.ar_invoicehistoryheader h
                              USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
          WHERE h.Company = :Company
            AND s.SalespersonDivisionNo = :SalespersonDivisionNo
            AND s.SalespersonNo = :SalespersonNo
            AND (
              h.InvoiceDate BETWEEN :minDate AND :maxDate
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 1
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 2
              )
            AND h.InvoiceType <> 'XD'
            AND (c.SalespersonDivisionNo <> s.SalespersonDivisionNo OR c.SalespersonNo <> s.SalespersonNo)
          GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode

          UNION

          SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 ''                                                  AS ShipToCode,
                 c.CustomerName,
                 c.EmailAddress,
                 SUM(h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt) AS OpenOrders,
                 0                                                   AS InvCYTD,
                 0                                                   AS INVPYTD,
                 0                                                   AS InvPY,
                 0                                                   AS InvP2TD,
                 0                                                   AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.SO_SalesOrderHeader h
                              USING (Company, ARDivisionNo, CustomerNo)
                   LEFT JOIN c2.SO_ShipToAddress s USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
          WHERE h.Company = :Company
            AND c.SalespersonDivisionNo = :SalespersonDivisionNo
            AND c.SalespersonNo = :SalespersonNo
            AND h.OrderType IN ('B', 'S')
            AND YEAR(h.ShipExpireDate) <= YEAR(:maxDate)
            AND IFNULL(s.SalespersonDivisionNo, c.SalespersonDivisionNo) = c.SalespersonDivisionNo
            AND IFNULL(s.SalespersonNo, c.SalespersonNo) = c.SalespersonNo
          GROUP BY Company, ARDivisionNo, CustomerNo

          UNION

          SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 IFNULL(s.ShipToCode, '')                            AS ShipToCode,
                 s.ShipToName,
                 s.EmailAddress,
                 SUM(h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt) AS OpenOrders,
                 0                                                   AS InvCYTD,
                 0                                                   AS INVPYTD,
                 0                                                   AS InvPY,
                 0                                                   AS InvP2TD,
                 0                                                   AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.SO_ShipToAddress s
                              USING (Company, ARDivisionNo, CustomerNo)
                   INNER JOIN c2.SO_SalesOrderHeader h
                              USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
          WHERE h.Company = :Company
            AND s.SalespersonDivisionNo = :SalespersonDivisionNo
            AND s.SalespersonNo = :SalespersonNo
            AND h.OrderType IN ('B', 'S')
            AND YEAR(h.ShipExpireDate) <= YEAR(:maxDate)
            AND (c.SalespersonDivisionNo <> s.SalespersonDivisionNo OR c.SalespersonNo <> s.SalespersonNo)
          GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) t
    GROUP BY Company,
             IF(:groupByCustomer, ARDivisionNo, ''),
             IF(:groupByCustomer, CustomerNo, ''),
             IF(:groupByCustomer, ShipToCode, '')
    ORDER BY InvCYTD DESC, INVPY DESC, INVP2 DESC
`;

export async function loadManagedCustomers({Company, SalespersonDivisionNo, SalespersonNo, maxDate, minDate, groupByCustomer}:LoadRepPaceProps):Promise<CustomerRow[]> {
    try {
        debug('loadManagedCustomers()', SalespersonDivisionNo, SalespersonNo);
        const [repCustomers] = await mysql2Pool.query<(CustomerRow & RowDataPacket)[]>(managedCustomersSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo,
            minDate,
            maxDate,
            groupByCustomer
        });
        // return repCustomers;
        return repCustomers.map(row => {
            const rate = calcGrowthRate(row.InvCYTD, row.InvPYTD);
            const _rate = new Decimal(row.InvPYTD).eq(0)
                ? (new Decimal(row.InvCYTD).lte(0) ? 0 : 1)
                : (new Decimal(row.InvCYTD).sub(row.InvPYTD).div(row.InvPYTD).toDecimalPlaces(4).toString());
            const pace = new Decimal(row.InvPY).eq(0)
                ? new Decimal(row.InvCYTD).add(row.OpenOrders).toDecimalPlaces(4).toString()
                : calcPace(row.InvPY, rate).toDecimalPlaces(4).toString(); //new Decimal(rate).add(1).times(row.InvPY).toDecimalPlaces(4).toString()
            return {
                ...row,
                rate: rate.toDecimalPlaces(4).toString(),
                pace
            }
        })
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadManagedCustomers()", err.message);
            return Promise.reject(err);
        }
        debug("loadManagedCustomers()", err);
        return Promise.reject(new Error('Error in loadManagedCustomers()'));
    }
}
