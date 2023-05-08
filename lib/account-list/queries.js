export const billToQuery = `
    SELECT c.ARDivisionNo,
           c.CustomerNo,
           ''                                                    AS ShipToCode,
           CONCAT(c.ARDivisionNo, '-', c.CustomerNo)             AS account,
           IFNULL(b2b.isb2b, '-')                                AS isb2b,
           c.CustomerName,
           c.AddressLine1,
           c.AddressLine2,
           c.AddressLine3,
           c.City,
           c.State,
           c.ZipCode,
           c.CountryCode,
           c.TelephoneNo,
           c.FaxNo,
           c.EmailAddress,
#                    c.SalespersonDivisionNo,
#                    c.SalespersonNo,
           CONCAT(c.SalespersonDivisionNo, '-', c.SalespersonNo) AS SalespersonNo,
           r.SalespersonName,
           c.DateCreated,
           c.CustomerType,
           c.PriceLevel,
           c.DateLastActivity,
           IF(IFNULL(:SalesP1, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p1MinDate AND :p1MaxDate), 0)
               )                                                 AS SalesP1,
           IF(IFNULL(:SalesP2, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p2MinDate AND :p2MaxDate), 0)
               )                                                 AS SalesP2,
           IF(IFNULL(:SalesP3, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p3MinDate AND :p3MaxDate), 0)
               )                                                 AS SalesP3,
           IF(IFNULL(:SalesP4, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p4MinDate AND :p4MaxDate), 0)
               )                                                 AS SalesP4,
           IF(IFNULL(:SalesP5, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p5MinDate AND :p5MaxDate), 0)
               )                                                 AS SalesP5
    FROM c2.ar_customer c
         INNER JOIN users.accounts a
                    ON userid = :userId AND c.Company LIKE a.Company
                        AND c.ardivisionno LIKE a.ARDivisionNo
                        AND ((c.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                             (c.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                        AND a.primaryAccount = 1
         LEFT JOIN  c2.ar_salesperson r
                    ON r.Company = c.Company
                        AND r.SalespersonDivisionNo = c.SalespersonDivisionNo
                        AND r.SalespersonNo = c.SalespersonNo
         LEFT JOIN  (
                    SELECT DISTINCT c.company, c.ARDivisionNo, c.CustomerNo, 'YES' AS isb2b
                    FROM users.users u
                         INNER JOIN users.accounts a
                                    ON a.userid = u.id
                         INNER JOIN c2.ar_customer c
                                    ON c.Company = a.Company AND c.ARDivisionNo = a.ARDivisionNo AND
                                       c.CustomerNo = a.CustomerNo
                    WHERE u.accountType = 4
                      AND u.active = 1
                    ) b2b
                    ON b2b.Company = c.company AND b2b.ARDivisionNo = c.ARdivisionno AND
                       b2b.CustomerNo = c.CustomerNo
    WHERE c.Company = :company
      AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
      AND (IFNULL(:CustomerNo, '') = '' OR CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) REGEXP :CustomerNo)
      AND (c.salespersonno LIKE :SalespersonNo
        OR r.SalesmanagerNo LIKE :SalespersonNo
        OR (c.SalespersonDivisionNo REGEXP :SalespersonDivisionNo AND c.SalespersonNo REGEXP :SalespersonNo)
        )
      AND (IFNULL(:State, '') = '' OR c.state LIKE :State)
      AND (IFNULL(:CountryCode, '') = '' OR c.countrycode LIKE :CountryCode)
      AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType LIKE :CustomerType)
      AND c.CustomerStatus = 'A'
      AND (
            (ISNULL(:DateCreatedMin) AND ISNULL(:DateCreatedMax))
            OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = FALSE AND
                DateCreated BETWEEN :DateCreatedMin AND :DateCreatedMax)
            OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = TRUE AND
                DateCreated >= :DateCreatedMin)
            OR (ISNULL(:DateCreatedMin) = TRUE AND ISNULL(:DateCreatedMax) = FALSE AND
                DateCreated <= :DateCreatedMax)
        )
      AND (
            (ISNULL(:DateLastActivityMin) AND ISNULL(:DateLastActivityMax))
            OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = FALSE AND
                DateLastActivity BETWEEN :DateLastActivityMin AND :DateLastActivityMax)
            OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = TRUE AND
                DateLastActivity >= :DateLastActivityMin)
            OR (ISNULL(:DateLastActivityMin) = TRUE AND ISNULL(:DateLastActivityMax) = FALSE AND
                DateLastActivity <= :DateLastActivityMax)
        )
`;



export const shipToQuery = `
    SELECT c.ARDivisionNo,
           c.CustomerNo,
           ''                                                    AS ShipToCode,
           CONCAT(c.ARDivisionNo, '-', c.CustomerNo)             AS account,
           IFNULL(b2b.isb2b, '-')                                AS isb2b,
           c.CustomerName,
           c.AddressLine1,
           c.AddressLine2,
           c.AddressLine3,
           c.City,
           c.State,
           c.ZipCode,
           c.CountryCode,
           c.TelephoneNo,
           c.FaxNo,
           c.EmailAddress,
#                    c.SalespersonDivisionNo,
#                    c.SalespersonNo,
           CONCAT(c.SalespersonDivisionNo, '-', c.SalespersonNo) AS SalespersonNo,
           r.SalespersonName,
           c.DateCreated,
           c.CustomerType,
           c.PriceLevel,
           c.DateLastActivity,
           IF(IFNULL(:SalesP1, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = ''
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p1MinDate AND :p1MaxDate), 0)
               )                                                 AS SalesP1,
           IF(IFNULL(:SalesP2, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = ''
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p2MinDate AND :p2MaxDate), 0)
               )                                                 AS SalesP2,
           IF(IFNULL(:SalesP3, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = ''
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p3MinDate AND :p3MaxDate), 0)
               )                                                 AS SalesP3,
           IF(IFNULL(:SalesP4, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = ''
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p4MinDate AND :p4MaxDate), 0)
               )                                                 AS SalesP4,
           IF(IFNULL(:SalesP5, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = ''
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p5MinDate AND :p5MaxDate), 0)
               )                                                 AS SalesP5
    FROM c2.ar_customer c
         INNER JOIN users.accounts a
                    ON userid = :userId AND c.Company LIKE a.Company
                        AND c.ardivisionno LIKE a.ARDivisionNo
                        AND ((c.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                             (c.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                        AND a.primaryAccount = 1
         LEFT JOIN  c2.ar_salesperson r
                    ON r.Company = c.Company
                        AND r.SalespersonDivisionNo = c.SalespersonDivisionNo
                        AND r.SalespersonNo = c.SalespersonNo
         LEFT JOIN  (
                    SELECT DISTINCT c.company, c.ARDivisionNo, c.CustomerNo, 'YES' AS isb2b
                    FROM users.users u
                         INNER JOIN users.accounts a
                                    ON a.userid = u.id
                         INNER JOIN c2.ar_customer c
                                    ON c.Company = a.Company AND c.ARDivisionNo = a.ARDivisionNo AND
                                       c.CustomerNo = a.CustomerNo
                    WHERE u.accountType = 4
                      AND u.active = 1
                    ) b2b
                    ON b2b.Company = c.company AND b2b.ARDivisionNo = c.ARdivisionno AND
                       b2b.CustomerNo = c.CustomerNo
    WHERE c.Company = :company
      AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
      AND (IFNULL(:CustomerNo, '') = '' OR CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) REGEXP :CustomerNo)
      AND (c.salespersonno LIKE :SalespersonNo
        OR r.SalesmanagerNo LIKE :SalespersonNo
        OR (c.SalespersonDivisionNo REGEXP :SalespersonDivisionNo AND c.SalespersonNo REGEXP :SalespersonNo)
        )
      AND (IFNULL(:State, '') = '' OR c.state LIKE :State)
      AND (IFNULL(:CountryCode, '') = '' OR c.countrycode LIKE :CountryCode)
      AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType LIKE :CustomerType)
      AND c.CustomerStatus = 'A'
      AND (
            (ISNULL(:DateCreatedMin) AND ISNULL(:DateCreatedMax))
            OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = FALSE AND
                DateCreated BETWEEN :DateCreatedMin AND :DateCreatedMax)
            OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = TRUE AND
                DateCreated >= :DateCreatedMin)
            OR (ISNULL(:DateCreatedMin) = TRUE AND ISNULL(:DateCreatedMax) = FALSE AND
                DateCreated <= :DateCreatedMax)
        )
      AND (
            (ISNULL(:DateLastActivityMin) AND ISNULL(:DateLastActivityMax))
            OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = FALSE AND
                DateLastActivity BETWEEN :DateLastActivityMin AND :DateLastActivityMax)
            OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = TRUE AND
                DateLastActivity >= :DateLastActivityMin)
            OR (ISNULL(:DateLastActivityMin) = TRUE AND ISNULL(:DateLastActivityMax) = FALSE AND
                DateLastActivity <= :DateLastActivityMax)
        )

    UNION

    SELECT c.ARDivisionNo,
           c.CustomerNo,
           s.ShipToCode                                                      AS ShipToCode,
           CONCAT(c.ARDivisionNo, '-', c.CustomerNo, '[', s.ShipToCode, ']') AS account,
           IFNULL(b2b.isb2b, '-')                                            AS isb2b,
           s.ShipToName                                                      AS CustomerName,
           s.ShipToAddress1                                                  AS AddressLine1,
           s.ShipToAddress2                                                  AS AddressLine2,
           s.ShipToAddress3                                                  AS AddressLine3,
           s.ShipToCity                                                      AS City,
           s.ShipToState                                                     AS State,
           s.ShipToZipCode                                                   AS ZipCode,
           s.ShipToCountryCode                                               AS CountryCode,
           s.TelephoneNo                                                     AS TelephoneNo,
           s.FaxNo                                                           AS FaxNo,
           s.EmailAddress                                                    AS EmailAddress,
#                    c.SalespersonDivisionNo,
#                    c.SalespersonNo,
           CONCAT(c.SalespersonDivisionNo, '-', s.SalespersonNo)             AS SalespersonNo,
           r.SalespersonName,
           s.DateCreated                                                     AS DateCreated,
           c.CustomerType,
           c.PriceLevel,
           c.DateLastActivity,
           IF(IFNULL(:SalesP1, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = s.ShipToCode
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p1MinDate AND :p1MaxDate), 0)
               )                                                             AS SalesP1,
           IF(IFNULL(:SalesP2, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = s.ShipToCode
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p2MinDate AND :p2MaxDate), 0)
               )                                                             AS SalesP2,
           IF(IFNULL(:SalesP3, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = s.ShipToCode
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p3MinDate AND :p3MaxDate), 0)
               )                                                             AS SalesP3,
           IF(IFNULL(:SalesP4, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = s.ShipToCode
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p4MinDate AND :p4MaxDate), 0)
               )                                                             AS SalesP4,
           IF(IFNULL(:SalesP5, 0) = 0,
              0,
              IFNULL((
                     SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                     FROM c2.ar_invoicehistoryheader h
                     WHERE h.Company = c.Company
                       AND h.ARDivisionNo = c.ardivisionno
                       AND h.CustomerNo = c.customerno
                       AND h.ShipToCode = s.ShipToCode
                       AND a.primaryAccount = 1
                       AND h.InvoiceDate BETWEEN :p5MinDate AND :p5MaxDate), 0)
               )                                                             AS SalesP5
    FROM c2.so_shiptoaddress s
         INNER JOIN c2.ar_customer c
                    ON c.Company = s.Company
                        AND c.ARDivisionNo = s.ARDivisionNo
                        AND c.CustomerNo = s.CustomerNo
         INNER JOIN users.accounts a
                    ON userid = :userId AND c.Company LIKE a.Company
                        AND s.ARDivisionNo LIKE a.ARDivisionNo
                        AND ((s.SalespersonNo LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                             (s.SalespersonNo LIKE a.CustomerNo AND a.isRepAccount = 0))
                        AND a.primaryAccount = 1
         LEFT JOIN  c2.ar_salesperson r
                    ON r.Company = c.Company
                        AND r.SalespersonDivisionNo = s.SalespersonDivisionNo
                        AND r.SalespersonNo = s.SalespersonNo
         LEFT JOIN  (
                    SELECT DISTINCT c.company, c.ARDivisionNo, c.CustomerNo, 'YES' AS isb2b
                    FROM users.users u
                         INNER JOIN users.accounts a
                                    ON a.userid = u.id
                         INNER JOIN c2.ar_customer c
                                    ON c.Company = a.Company AND c.ARDivisionNo = a.ARDivisionNo AND
                                       c.CustomerNo = a.CustomerNo
                    WHERE u.accountType = 4
                      AND u.active = 1
                    ) b2b
                    ON b2b.Company = c.company AND b2b.ARDivisionNo = c.ARdivisionno AND
                       b2b.CustomerNo = c.CustomerNo
    WHERE c.Company = :company
      AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
      AND (IFNULL(:CustomerNo, '') = '' OR CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) REGEXP :CustomerNo)
      AND (s.salespersonno LIKE :SalespersonNo
        OR r.SalesmanagerNo LIKE :SalespersonNo
        OR (s.SalespersonDivisionNo REGEXP :SalespersonDivisionNo AND s.SalespersonNo REGEXP :SalespersonNo)
        )
      AND (IFNULL(:State, '') = '' OR c.state LIKE :State)
      AND (IFNULL(:CountryCode, '') = '' OR c.countrycode LIKE :CountryCode)
      AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType LIKE :CustomerType)
      AND c.CustomerStatus = 'A'
      AND (
            (ISNULL(:DateCreatedMin) AND ISNULL(:DateCreatedMax))
            OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = FALSE AND
                c.DateCreated BETWEEN :DateCreatedMin AND :DateCreatedMax)
            OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = TRUE AND
                c.DateCreated >= :DateCreatedMin)
            OR (ISNULL(:DateCreatedMin) = TRUE AND ISNULL(:DateCreatedMax) = FALSE AND
                c.DateCreated <= :DateCreatedMax)
        )
      AND (
            (ISNULL(:DateLastActivityMin) AND ISNULL(:DateLastActivityMax))
            OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = FALSE AND
                DateLastActivity BETWEEN :DateLastActivityMin AND :DateLastActivityMax)
            OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = TRUE AND
                DateLastActivity >= :DateLastActivityMin)
            OR (ISNULL(:DateLastActivityMin) = TRUE AND ISNULL(:DateLastActivityMax) = FALSE AND
                DateLastActivity <= :DateLastActivityMax)
        )
`;

