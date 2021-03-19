SELECT d.ARDivisionNo                                                  AS PrimaryValue,
       d.ARDivisionDesc                                                AS description,
       d.ARDivisionNo                                                  AS SortField,
       SUM(IFNULL(h.p1_shipped, 0))                                    AS p1_shipped,
       SUM(IFNULL(h.p1_sales, 0))                                      AS p1_sales,
       IF(IFNULL(:disc, '') = '1', SUM(IFNULL(h.p1_disc, 0)), 0)       AS p1_discount,
       SUM(IFNULL(h.p1_cogs, 0))                                       AS p1_cogs,
       IF(IFNULL(:open, '') = '1', SUM(IFNULL(h.p1_open, 0)), 0)       AS p1_open,
       IF(IFNULL(:open, '') = '1', SUM(IFNULL(h.p1_open_sales, 0)), 0) AS p1_open_sales,
       IF(IFNULL(:open, '') = '1', SUM(IFNULL(h.p1_open_cogs, 0)), 0)  AS p1_open_cogs,

       SUM(IFNULL(h.p2_shipped, 0))                                    AS p2_shipped,
       SUM(IFNULL(h.p2_sales, 0))                                      AS p2_sales,
       IF(IFNULL(:disc, '') = '1', SUM(IFNULL(h.p2_disc, 0)), 0)       AS p2_discount,
       SUM(IFNULL(h.p2_cogs, 0))                                       AS p2_cogs,
       IF(IFNULL(:open, '') = '1', SUM(IFNULL(h.p2_open, 0)), 0)       AS p2_open,
       IF(IFNULL(:open, '') = '1', SUM(IFNULL(h.p2_open_sales, 0)), 0) AS p2_open_sales,
       IF(IFNULL(:open, '') = '1', SUM(IFNULL(h.p2_open_cogs, 0)), 0)  AS p2_open_cogs
FROM c2.ar_division d
     INNER JOIN (
                SELECT h.Company,
                       d.ItemCode,
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
                     INNER JOIN c2.ar_customer c
                                ON c.Company = h.Company
                                    AND c.ardivisionno = h.ardivisionno
                                    AND c.customerno = h.customerno
                     LEFT JOIN  c2.ci_item im
                                ON im.Company = d.Company
                                    AND im.ItemCode = d.ItemCode
                     LEFT JOIN  c2.gl_account gl
                                ON gl.Company = d.Company
                                    AND gl.AccountKey = d.SalesAcctKey
                     LEFT JOIN  c2.gl_account costgl
                                ON costgl.Company = d.Company
                                    AND costgl.AccountKey = d.CostOfGoodsSoldAcctKey
                LEFT JOIN c2.IM_ItemWarehouseAdditional da on da.company = d.Company and da.ItemCode = d.ItemCode and da.WarehouseCode = d.WarehouseCode
                WHERE h.Company = :company
                  AND h.InvoiceDate BETWEEN :p1min AND :p1max
                  AND InvoiceType != 'XD'
                  AND d.ItemCode != '/C'
                  AND d.ExplodedKitItem <> 'C'
                  AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
                  AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
                  AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
                  AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
                  AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType REGEXP :CustomerType)
                  AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
                  AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
                  AND (IFNULL(:ItemCode, '') = ''
                    OR im.ItemCode REGEXP :ItemCode
                    )
                  AND (IFNULL(:GLAccount, '') = ''
                    OR gl.Account REGEXP :GLAccount
                    OR (:GLAccount = 'NULL' AND gl.Account IS NULL)
                    )
                  AND (IFNULL(:CostAccount, '') = ''
                    OR costgl.Account REGEXP :CostAccount
                    OR (:CostAccount = 'NULL' AND costgl.Account IS NULL)
                    )
                  AND (IFNULL(:ProductLine, '') = '' OR d.ProductLine REGEXP :ProductLine)
                  AND (IFNULL(:Category2, '') = ''
                    OR (:Category2 = 'NULL' AND im.Category2 IS NULL)
                    OR (:Category2 = '/MISC' AND im.Category2 REGEXP '^$')
                    OR im.Category2 REGEXP :Category2
                    )
                  AND (IFNULL(:Category3, '') = ''
                    OR (:Category3 = 'NULL' AND im.Category3 IS NULL)
                    OR (:Category3 = '/MISC' AND im.Category3 REGEXP '^$')
                    OR im.Category3 REGEXP :Category3
                    )
                  AND (IFNULL(:Category4, '') = ''
                    OR (:Category4 = 'NULL' AND im.Category4 IS NULL)
                    OR (:Category4 = '/MISC' AND im.Category4 REGEXP '^$')
                    OR im.Category4 REGEXP :Category4
                    )
                  AND (IFNULL(:PrimaryVendorNo, '') = ''
                    OR im.PrimaryVendorNo REGEXP :PrimaryVendorNo
                    )
                  AND (IFNULL(:CountryOfOrigin, '') = ''
                    OR im.UDF_COUNTRY_ORIGIN REGEXP :CountryOfOrigin
                    )
                AND (IFNULL(:ProductStatus, '') = '' OR da.ItemStatus REGEXP :ProductStatus)

                GROUP BY Company, ItemCode

                UNION ALL
                /* invoiced period 2 */
                SELECT h.Company,
                       h.ARDivisionNo,
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
                     INNER JOIN c2.ar_customer c
                                ON c.Company = h.Company
                                    AND c.ardivisionno = h.ardivisionno
                                    AND c.customerno = h.customerno
                     LEFT JOIN  c2.ci_item im
                                ON im.Company = d.Company
                                    AND im.ItemCode = d.ItemCode
                     LEFT JOIN  c2.gl_account gl
                                ON gl.Company = d.Company
                                    AND gl.AccountKey = d.SalesAcctKey
                     LEFT JOIN  c2.gl_account costgl
                                ON costgl.Company = d.Company
                                    AND costgl.AccountKey = d.CostOfGoodsSoldAcctKey
                WHERE h.Company = :company
                  AND h.InvoiceDate BETWEEN :p2min AND :p2max
                  AND InvoiceType != 'XD'
                  AND d.ItemCode != '/C'
                  AND d.ExplodedKitItem <> 'C'
                  AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
                  AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
                  AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
                  AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
                  AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType REGEXP :CustomerType)
                  AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
                  AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
                  AND (IFNULL(:GLAccount, '') = ''
                    OR gl.Account REGEXP :GLAccount
                    OR (:GLAccount = 'NULL' AND gl.Account IS NULL)
                    )
                  AND (IFNULL(:CostAccount, '') = ''
                    OR costgl.Account REGEXP :CostAccount
                    OR (:CostAccount = 'NULL' AND costgl.Account IS NULL)
                    )
                  AND (IFNULL(:ProductLine, '') = '' OR d.ProductLine REGEXP :ProductLine)
                  AND (IFNULL(:Category2, '') = ''
                    OR (:Category2 = 'NULL' AND im.Category2 IS NULL)
                    OR (:Category2 = '/MISC' AND im.Category2 REGEXP '^$')
                    OR im.Category2 REGEXP :Category2
                    )
                GROUP BY h.Company, h.ARDivisionNo
                UNION ALL

                /* invoiced discounts for period */
                SELECT c.Company,
                       c.ARDivisionNo,
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
                  AND h.InvoiceType != 'XD'
                  AND h.DiscountAmt <> 0
                  AND h.InvoiceDate BETWEEN :p1min AND :p1max
                  AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
                  AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
                  AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
                  AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
                  AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType REGEXP :CustomerType)
                  AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
                  AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
                GROUP BY c.Company, c.ARDivisionNo

                UNION ALL
                /* invoiced discounts period 2 */
                SELECT c.Company,
                       c.ARDivisionNo,
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
                  AND h.InvoiceType != 'XD'
                  AND h.DiscountAmt <> 0
                  AND h.InvoiceDate BETWEEN :p2min AND :p2max
                  AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
                  AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
                  AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
                  AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
                  AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType REGEXP :CustomerType)
                  AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
                  AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
                GROUP BY c.Company, c.ARDivisionNo

                UNION ALL
                /* Open Period 1 */
                SELECT h.Company,
                       h.ARDivisionNo,
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
                     INNER JOIN c2.ar_customer c
                                ON c.Company = h.Company
                                    AND c.ardivisionno = h.ardivisionno
                                    AND c.customerno = h.customerno
                     LEFT JOIN  c2.ci_item im
                                ON im.Company = d.Company
                                    AND im.ItemCode = d.ItemCode
                     LEFT JOIN  c2.gl_account gl
                                ON gl.Company = d.Company
                                    AND gl.AccountKey = d.SalesAcctKey
                     LEFT JOIN  c2.gl_account costgl
                                ON costgl.Company = d.Company
                                    AND costgl.AccountKey = d.CostOfGoodsSoldAcctKey
                WHERE h.Company = :company
                  AND h.OrderType  in ('B', 'S')
                  AND h.ShipExpireDate BETWEEN :p1min AND :p1max
                  AND d.ItemCode != '/C'
                  AND d.ExplodedKitItem <> 'C'
                  AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
                  AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
                  AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
                  AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
                  AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType REGEXP :CustomerType)
                  AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
                  AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
                  AND (IFNULL(:GLAccount, '') = ''
                    OR gl.Account REGEXP :GLAccount
                    OR (:GLAccount = 'NULL' AND gl.Account IS NULL)
                    )
                  AND (IFNULL(:CostAccount, '') = ''
                    OR costgl.Account REGEXP :CostAccount
                    OR (:CostAccount = 'NULL' AND costgl.Account IS NULL)
                    )
                  AND (IFNULL(:ProductLine, '') = '' OR im.ProductLine REGEXP :ProductLine)
                  AND (IFNULL(:Category2, '') = ''
                    OR (:Category2 = 'NULL' AND im.Category2 IS NULL)
                    OR (:Category2 = '/MISC' AND im.Category2 REGEXP '^$')
                    OR im.Category2 REGEXP :Category2
                    )
                GROUP BY h.Company, h.ARDivisionNo

                UNION ALL
                /* Open Period 1 */
                SELECT h.Company,
                       h.ARDivisionNo,
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
                     INNER JOIN c2.ar_customer c
                                ON c.Company = h.Company
                                    AND c.ardivisionno = h.ardivisionno
                                    AND c.customerno = h.customerno
                     LEFT JOIN  c2.ci_item im
                                ON im.Company = d.Company
                                    AND im.ItemCode = d.ItemCode
                     LEFT JOIN  c2.gl_account gl
                                ON gl.Company = d.Company
                                    AND gl.AccountKey = d.SalesAcctKey
                     LEFT JOIN  c2.gl_account costgl
                                ON costgl.Company = d.Company
                                    AND costgl.AccountKey = d.CostOfGoodsSoldAcctKey
                WHERE h.Company = :company
                  AND h.OrderType  in ('B', 'S')
                  AND h.ShipExpireDate BETWEEN :p2min AND :p2max
                  AND d.ItemCode != '/C'
                  AND d.ExplodedKitItem <> 'C'
                  AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
                  AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
                  AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
                  AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
                  AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType REGEXP :CustomerType)
                  AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
                  AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
                  AND (IFNULL(:GLAccount, '') = ''
                    OR gl.Account REGEXP :GLAccount
                    OR (:GLAccount = 'NULL' AND gl.Account IS NULL)
                    )
                  AND (IFNULL(:CostAccount, '') = ''
                    OR costgl.Account REGEXP :CostAccount
                    OR (:CostAccount = 'NULL' AND costgl.Account IS NULL)
                    )
                  AND (IFNULL(:ProductLine, '') = '' OR im.ProductLine REGEXP :ProductLine)
                  AND (IFNULL(:Category2, '') = ''
                    OR (:Category2 = 'NULL' AND im.Category2 IS NULL)
                    OR (:Category2 = '/MISC' AND im.Category2 REGEXP '^$')
                    OR im.Category2 REGEXP :Category2
                    )
                GROUP BY Company, ARDivisionNo

                ) h
                ON h.Company = d.Company
                    AND h.ARDivisionNo = d.ardivisionno
WHERE d.ARDivisionNo <> '00'
GROUP BY PrimaryValue
ORDER BY PrimaryValue
LIMIT :LIMIT
