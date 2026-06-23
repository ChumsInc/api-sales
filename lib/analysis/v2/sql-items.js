export const sqlItems = `
    CREATE TEMPORARY TABLE IF NOT EXISTS TEMP_SA_Items
    (
        ItemCode VARCHAR(30),
        PRIMARY KEY (ItemCode)
    );

    INSERT INTO TEMP_SA_Items (ItemCode)
    SELECT ItemCode
    FROM c2.CI_Item i
    WHERE company = 'chums'
      AND i.ItemType in ('1', '3', '5')
      AND (IFNULL(:ItemCode, '') = ''
        OR i.ItemCode REGEXP :ItemCode
        )
      AND (IFNULL(:ProductLine, '') = '' OR i.ProductLine REGEXP :ProductLine)
      AND (IFNULL(:Category2, '') = ''
        OR (:Category2 = 'NULL' AND i.Category2 IS NULL)
        OR (:Category2 IN ('/MISC', 'N/A') AND i.Category2 = '')
        OR i.Category2 REGEXP :Category2
        )
      AND (IFNULL(:Category3, '') = ''
        OR (:Category3 = 'NULL' AND i.Category3 IS NULL)
        OR (:Category3 IN ('/MISC', 'N/A') AND i.Category3 = '')
        OR i.Category3 REGEXP :Category3
        )
      AND (IFNULL(:BaseSKU, '') = ''
        OR (:BaseSKU = 'NULL' AND i.Category4 IS NULL)
        OR (:BaseSKU IN ('/MISC', 'N/A') AND i.Category4 = '')
        OR i.Category4 REGEXP :BaseSKU
        )
      AND (IFNULL(:PrimaryVendorNo, '') = ''
        OR i.PrimaryVendorNo REGEXP :PrimaryVendorNo
        OR (:PrimaryVendorNo = 'NULL' AND i.PrimaryVendorNo IS NULL)
        )
      AND (IFNULL(:CountryOfOrigin, '') = ''
        OR i.UDF_COUNTRY_ORIGIN REGEXP :CountryOfOrigin
        OR (:CountryOfOrigin = 'NULL' AND i.UDF_COUNTRY_ORIGIN IS NULL)
        );

    SET @hasItemFilters =  (
        IFNULL(:ItemCode, '') <> ''
            OR IFNULL(:ProductLine, '') <> ''
            OR IFNULL(:Category2, '') <> ''
            OR IFNULL(:Category3, '') <> ''
            OR IFNULL(:BaseSKU, '') <> ''
            OR IFNULL(:PrimaryVendorNo, '') <> ''
            OR IFNULL(:CountryOfOrigin, '') <> ''
            OR IFNULL(:ProductStatus, '') <> ''
        );
`;
