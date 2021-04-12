exports.joinedTables = `
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
    LEFT JOIN  c2.IM_ItemWarehouseAdditional ps
            ON ps.company = d.Company
                AND ps.ItemCode = d.ItemCode
                AND ps.WarehouseCode = d.WarehouseCode
`;

exports.customerFilters = `
AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
AND (IFNULL(:ShipToCode, '') = '' OR h.ShipToCode REGEXP :ShipToCode)
AND (IFNULL(:SalespersonNo, '') = '' OR c.SalespersonNo REGEXP :SalespersonNo)
AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType IN (
    SELECT DISTINCT c.CustomerType as CustomerType
    FROM c2.ar_customer c 
    LEFT JOIN c2.AR_CustomerType t on c.CustomerType = t.CustomerType 
    WHERE ifnull(t.ReportAsType, c.CustomerType) REGEXP :CustomerType
    )  
)
AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
AND (IFNULL(:ShipToState, '') = '' OR h.ShipToState REGEXP :ShipToState)
`;

exports.itemFilters = `
  AND (IFNULL(:ItemCode, '') = ''
    OR im.ItemCode REGEXP :ItemCode
    )
  AND (IFNULL(:SalesAccount, '') = ''
    OR gl.Account REGEXP :SalesAccount
    OR (:SalesAccount = 'NULL' AND gl.Account IS NULL)
    )
  AND (IFNULL(:CostAccount, '') = ''
    OR costgl.Account REGEXP :CostAccount
    OR (:CostAccount = 'NULL' AND costgl.Account IS NULL)
    )
  AND (IFNULL(:ProductLine, '') = '' OR im.ProductLine REGEXP :ProductLine)
  AND (IFNULL(:Category2, '') = ''
    OR (:Category2 = 'NULL' AND im.Category2 IS NULL)
    OR (:Category2 IN ('/MISC', 'N/A') AND im.Category2 = '')
    OR im.Category2 REGEXP :Category2
    )
  AND (IFNULL(:Category3, '') = ''
    OR (:Category3 = 'NULL' AND im.Category3 IS NULL)
    OR (:Category3 in ('/MISC', 'N/A') AND im.Category3 = '')
    OR im.Category3 REGEXP :Category3
    )
  AND (IFNULL(:BaseSKU, '') = ''
    OR (:BaseSKU = 'NULL' AND im.Category4 IS NULL)
    OR (:BaseSKU IN ('/MISC', 'N/A') AND im.Category4 = '')
    OR im.Category4 REGEXP :BaseSKU
    )
  AND (IFNULL(:PrimaryVendorNo, '') = ''
    OR im.PrimaryVendorNo REGEXP :PrimaryVendorNo
    OR (:PrimaryVendorNo = 'NULL' AND im.PrimaryVendorNo is null) 
    )
  AND (IFNULL(:CountryOfOrigin, '') = ''
    OR im.UDF_COUNTRY_ORIGIN REGEXP :CountryOfOrigin
    OR (:CountryOfOrigin = 'NULL' AND im.UDF_COUNTRY_ORIGIN is null)
    )
  AND (IFNULL(:ProductStatus, '') = '' OR ps.ItemStatus REGEXP :ProductStatus)
`;

exports.invoiceFilters = `
AND h.InvoiceType != 'XD'
AND d.ItemCode != '/C'
AND d.ExplodedKitItem <> 'C'
`;

exports.invoiceDiscountFilters = `
AND h.InvoiceType != 'XD'
AND h.DiscountAmt <> 0
`;

exports.openOrderFilters = `
AND h.OrderType IN ('B', 'S')
AND d.ItemCode != '/C'
AND (d.SalesKitLineKey = '' OR d.ExplodedKitItem = 'Y')
`;
