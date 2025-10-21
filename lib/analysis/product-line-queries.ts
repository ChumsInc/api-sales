import {combineQueries} from './combine-queries.js';
import {customerFilters, invoiceFilters, itemFilters, joinedTables, openOrderFilters} from './query-snippets.js';
import {SACombineOptions} from "./sa-types.js";

const qryInvoicedP1 = `
    SELECT h.Company,
           d.ProductLine,
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
      AND h.InvoiceDate BETWEEN :p1min
        AND :p1max ${invoiceFilters} ${customerFilters} ${itemFilters}
    GROUP BY Company, ProductLine
`;

const qryInvoicedP2 = `
    SELECT h.Company,
           d.ProductLine,
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
      AND h.InvoiceDate BETWEEN :p2min
      AND :p2max ${invoiceFilters} ${customerFilters} ${itemFilters}
    GROUP BY Company, ProductLine
`;

const qryOpenP1 = `
    SELECT h.Company,
           im.ProductLine,
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
      AND h.ShipExpireDate BETWEEN :p1min
      AND :p1max ${openOrderFilters} ${customerFilters} ${itemFilters}
    GROUP BY Company, ProductLine
`;

const qryOpenP2 = `
    SELECT h.Company,
           im.ProductLine,
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
      AND h.ShipExpireDate BETWEEN :p2min
      AND :p2max ${openOrderFilters} ${customerFilters} ${itemFilters}
    GROUP BY Company, ProductLine
`;

const query = `
    SELECT ifnull(nullif(ifnull(d.ProductLine, h.ProductLine), ''), 'N/A')       AS key_field,
           ifnull(d.ProductLineDesc, 'N/A')                                      as ProductLineDesc,
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
    FROM ($SUB_QUERIES$) h
             LEFT JOIN c2.IM_ProductLine d
                       ON h.Company = d.Company
                           AND h.ProductLine = d.ProductLine
    GROUP BY h.Company, h.ProductLine
    ORDER BY $ORDER_BY$
    LIMIT :limit
`;

export const buildQuery = (options: SACombineOptions) => {
    return combineQueries({
        query,
        options,
        qryInvoicedP1,
        qryInvoicedP2,
        qryOpenP1,
        qryOpenP2
    })
}
