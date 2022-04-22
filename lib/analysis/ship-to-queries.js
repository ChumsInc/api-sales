const {combineQueries} = require('./combine-queries');
const {
    joinedTables,
    customerFilters,
    invoiceDiscountFilters,
    invoiceFilters,
    itemFilters,
    openOrderFilters
} = require('./query-snippets');

const qryInvoicedP1 = `
SELECT h.Company,
       h.ARDivisionNo,
       h.CustomerNo,
       h.ShipToCode,
       SUM(d.QuantityShipped * d.UnitOfMeasureConvFactor) AS p1_shipped,
       SUM(d.ExtensionAmt)                                AS p1_sales,
       SUM(d.QuantityShipped * d.UnitCost)                AS p1_cogs,
       0                                                  AS p1_disc,
       0                                                  AS p1_open,
       0                                                  AS p1_open_sales,
       0                                                  AS p1_open_cogs,

       0                                                  AS p2_shipped,
       0                                                  AS p2_sales,
       0                                                  AS p2_cogs,
       0                                                  AS p2_disc,
       0                                                  AS p2_open,
       0                                                  AS p2_open_sales,
       0                                                  AS p2_open_cogs
FROM c2.ar_invoicehistoryheader h
     INNER JOIN c2.ar_invoicehistorydetail d
                ON d.Company = h.Company
                    AND d.InvoiceNo = h.InvoiceNo
                    AND d.HeaderSeqNo = h.HeaderSeqNo
     ${joinedTables}
WHERE h.Company = :company
  AND h.InvoiceDate BETWEEN :p1min AND :p1max
  ${invoiceFilters}
  ${customerFilters}
  ${itemFilters}
GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode
`;

const qryInvoicedP2 = `
SELECT h.Company,
       h.ARDivisionNo,
       h.CustomerNo,
       h.ShipToCode,
       0                                                  AS p1_shipped,
       0                                                  AS p1_sales,
       0                                                  AS p1_cogs,
       0                                                  AS p1_disc,
       0                                                  AS p1_open,
       0                                                  AS p1_open_sales,
       0                                                  AS p1_open_cogs,

       SUM(d.QuantityShipped * d.UnitOfMeasureConvFactor) AS p2_shipped,
       SUM(d.ExtensionAmt)                                AS p2_sales,
       SUM(d.QuantityShipped * d.UnitCost)                AS p2_cogs,
       0                                                  AS p2_disc,
       0                                                  AS p2_open,
       0                                                  AS p2_open_sales,
       0                                                  AS p2_open_cogs
FROM c2.ar_invoicehistoryheader h
     INNER JOIN c2.ar_invoicehistorydetail d
                ON d.Company = h.Company
                    AND d.InvoiceNo = h.InvoiceNo
                    AND d.HeaderSeqNo = h.HeaderSeqNo
     ${joinedTables}
WHERE h.Company = :company
  AND h.InvoiceDate BETWEEN :p2min AND :p2max
  ${invoiceFilters}
  ${customerFilters}
  ${itemFilters}
GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode
`;

const qryInvoiceDiscountP1 = `
    /* invoiced discounts for period */
    SELECT h.Company,
           h.ARDivisionNo,
           h.CustomerNo,
           h.ShipToCode,
           0                  AS p1_shipped,
           0                  AS p1_sales,
           0                  AS p1_cogs,
           SUM(h.DiscountAmt) AS p1_disc,
           0                  AS p1_open,
           0                  AS p1_open_sales,
           0                  AS p1_open_cogs,

           0                  AS p2_shipped,
           0                  AS p2_sales,
           0                  AS p2_cogs,
           0                  AS p2_open,
           0                  AS p2_open_sales,
           0                  AS p2_open_cogs,
           0                  AS p2_disc
    FROM c2.ar_invoicehistoryheader h
         INNER JOIN c2.ar_customer c
                    ON c.company = h.Company AND c.ardivisionno = h.ARDivisionNo AND
                       c.customerno = h.CustomerNo
    WHERE c.Company = :company
      AND h.InvoiceDate BETWEEN :p1min AND :p1max
      ${invoiceDiscountFilters}
      ${customerFilters}
    GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode`;

const qryInvoiceDiscountP2 = `
    SELECT h.Company,
           h.ARDivisionNo,
           h.CustomerNo,
           h.ShipToCode,
           0                  AS p1_shipped,
           0                  AS p1_sales,
           0                  AS p1_cogs,
           0                  AS p1_disc,
           0                  AS p1_open,
           0                  AS p1_open_sales,
           0                  AS p1_open_cogs,

           0                  AS p2_shipped,
           0                  AS p2_sales,
           0                  AS p2_cogs,
           SUM(h.DiscountAmt) AS p2_disc,
           0                  AS p2_open,
           0                  AS p2_open_sales,
           0                  AS p2_open_cogs
    FROM c2.ar_invoicehistoryheader h
         INNER JOIN c2.ar_customer c
                    ON c.company = h.Company AND c.ardivisionno = h.ARDivisionNo AND
                       c.customerno = h.CustomerNo
    WHERE c.Company = :company
      AND h.InvoiceDate BETWEEN :p2min AND :p2max
      ${invoiceDiscountFilters}
      ${customerFilters}
    GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode
`;

const qryOpenP1 = `
SELECT h.Company,
       h.ARDivisionNo,
       h.CustomerNo,
       h.ShipToCode,
       0                                                                        AS p1_shipped,
       0                                                                        AS p1_sales,
       0                                                                        AS p1_cogs,
       0                                                                        AS p1_disc,
       SUM((d.QuantityOrdered - d.QuantityShipped) * d.UnitOfMeasureConvFactor) AS p1_open,
       SUM((d.QuantityOrdered - d.QuantityShipped) * d.UnitPrice)               AS p1_open_sales,
       SUM((d.QuantityOrdered - d.QuantityShipped) * d.UnitCost)                AS p1_open_cogs,

       0                                                                        AS p2_shipped,
       0                                                                        AS p2_sales,
       0                                                                        AS p2_cogs,
       0                                                                        AS p2_disc,
       0                                                                        AS p2_open,
       0                                                                        AS p2_open_sales,
       0                                                                        AS p2_open_cogs
FROM c2.SO_SalesOrderHeader h
     INNER JOIN c2.SO_SalesOrderDetail d
                ON d.Company = h.Company
                    AND d.SalesOrderNo = h.SalesOrderNo
     ${joinedTables}
WHERE h.Company = :company
  AND h.ShipExpireDate BETWEEN :p1min AND :p1max
  ${openOrderFilters}
  ${customerFilters}
  ${itemFilters}
GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode
`;

const qryOpenP2 = `
SELECT h.Company,
       h.ARDivisionNo,
       h.CustomerNo,
       h.ShipToCode,
       0                                                                        AS p1_shipped,
       0                                                                        AS p1_sales,
       0                                                                        AS p1_cogs,
       0                                                                        AS p1_disc,
       0                                                                        AS p1_open,
       0                                                                        AS p1_open_sales,
       0                                                                        AS p1_open_cogs,

       0                                                                        AS p2_shipped,
       0                                                                        AS p2_sales,
       0                                                                        AS p2_cogs,
       0                                                                        AS p2_disc,
       SUM((d.QuantityOrdered - d.QuantityShipped) * d.UnitOfMeasureConvFactor) AS p2_open,
       SUM((d.QuantityOrdered - d.QuantityShipped) * d.UnitPrice)               AS p2_open_sales,
       SUM((d.QuantityOrdered - d.QuantityShipped) * d.UnitCost)                AS p2_open_cogs
FROM c2.SO_SalesOrderHeader h
     INNER JOIN c2.SO_SalesOrderDetail d
                ON d.Company = h.Company
                    AND d.SalesOrderNo = h.SalesOrderNo
     ${joinedTables}
WHERE h.Company = :company
  AND h.ShipExpireDate BETWEEN :p2min AND :p2max
  ${openOrderFilters}
  ${customerFilters}
  ${itemFilters}
GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode
`;

const query = `
    SELECT concat(h.ARDivisionNo, '-', h.CustomerNo, if(isnull(h.ShipToCode), '', concat('/', h.ShipToCode)))                                                        AS key_field,
           h.ARDivisionNo,
           h.CustomerNo,
           ifnull(d.CustomerName, s.ShipToName) as CustomerName,
           h.ShipToCode,
           ifnull(s.ShipToName, d.CustomerName) as ShipToName,
           SUM(IFNULL(h.p1_shipped, 0))                                          AS p1_shipped,
           SUM(IFNULL(h.p1_sales, 0))                                            AS p1_sales,
           IF(IFNULL(:discounts, '') = '1', SUM(IFNULL(h.p1_disc, 0)), 0)        AS p1_discount,
           SUM(IFNULL(h.p1_cogs, 0))                                             AS p1_cogs,
           IF(IFNULL(:openOrders, '') = '1', SUM(IFNULL(h.p1_open, 0)), 0)       AS p1_open,
           IF(IFNULL(:openOrders, '') = '1', SUM(IFNULL(h.p1_open_sales, 0)), 0) AS p1_open_sales,
           IF(IFNULL(:openOrders, '') = '1', SUM(IFNULL(h.p1_open_cogs, 0)), 0)  AS p1_open_cogs,

           SUM(IFNULL(h.p2_shipped, 0))                                          AS p2_shipped,
           SUM(IFNULL(h.p2_sales, 0))                                            AS p2_sales,
           IF(IFNULL(:discounts, '') = '1', SUM(IFNULL(h.p2_disc, 0)), 0)        AS p2_discount,
           SUM(IFNULL(h.p2_cogs, 0))                                             AS p2_cogs,
           IF(IFNULL(:openOrders, '') = '1', SUM(IFNULL(h.p2_open, 0)), 0)       AS p2_open,
           IF(IFNULL(:openOrders, '') = '1', SUM(IFNULL(h.p2_open_sales, 0)), 0) AS p2_open_sales,
           IF(IFNULL(:openOrders, '') = '1', SUM(IFNULL(h.p2_open_cogs, 0)), 0)  AS p2_open_cogs
    FROM ( $SUB_QUERIES$ ) h
         LEFT JOIN c2.ar_customer d
                    ON h.Company = d.Company
                    AND h.ARDivisionNo = d.ardivisionno 
                    AND h.CustomerNo = d.CustomerNo
                    AND h.ShipToCode = '' 
         LEFT JOIN c2.so_shiptoaddress s 
                ON s.Company = h.Company
                AND s.ARDivisionNo = h.ARDivisionNo
                AND s.CustomerNo = h.CustomerNo
                AND s.ShipToCode = h.ShipToCode
    GROUP BY h.Company, h.ARDivisionNo, h.CustomerNo, h.ShipToCode
    ORDER BY $ORDER_BY$
    LIMIT :limit
`;

exports.buildQuery = (options) => {
    return combineQueries({
        query,
        options,
        qryInvoicedP1,
        qryInvoicedP2,
        qryInvoiceDiscountP1,
        qryInvoiceDiscountP2,
        qryOpenP1,
        qryOpenP2
    })
}