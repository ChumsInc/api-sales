export const sqlCustomers = `
    CREATE TEMPORARY TABLE IF NOT EXISTS TEMP_SA_Customers
    (
        ARDivisionNo VARCHAR(2),
        CustomerNo   VARCHAR(20),
        PRIMARY KEY (ARDivisionNo, CustomerNo)
    );

    INSERT INTO TEMP_SA_Customers (ARDivisionNo, CustomerNo)
    WITH CustomerTypes AS (SELECT DISTINCT IFNULL(NULLIF(c.CustomerType, ''), 'N/A') AS CustomerType
                           FROM c2.ar_customer c
                                    LEFT JOIN c2.AR_CustomerType t ON c.CustomerType = t.CustomerType
                           WHERE IFNULL(t.ReportAsType, IFNULL(NULLIF(c.CustomerType, ''), 'N/A')) REGEXP :CustomerType
                              OR IFNULL(NULLIF(c.CustomerType, ''), 'N/A') REGEXP :CustomerType),
         Reps AS (SELECT SalespersonDivisionNo, SalespersonNo
                  FROM c2.ar_salesperson
                  WHERE Company = 'chums'
                    AND SalespersonNo REGEXP IFNULL(:SalespersonNo, ''))
    SELECT c.ARDivisionNo, c.CustomerNo
    FROM c2.ar_customer c
    WHERE c.company = 'chums'
      AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
      AND (IFNULL(:CustomerNo, '') = '' OR c.CustomerNo REGEXP :CustomerNo)
      AND (IFNULL(:SalespersonNo, '') = ''
        OR EXISTS (SELECT 1 FROM Reps WHERE SalespersonNo = c.SalespersonNo))
      AND (IFNULL(:CustomerType, '') = ''
        OR EXISTS (SELECT 1 FROM CustomerTypes WHERE CustomerType = c.CustomerType)
        )
      AND (IFNULL(:CustomerGroup, '') = ''
        OR c.SortField REGEXP :CustomerGroup
        OR (:CustomerGroup = 'NULL' AND c.SortField IS NULL))
      AND (IFNULL(:State, '') = '' OR c.State REGEXP :State)
      AND (IFNULL(:CountryCode, '') = '' OR c.CountryCode REGEXP :CountryCode)
    AND (IFNULL(:minCreatedDate, '') = '' OR c.DateCreated >= :minCreatedDate)
    AND (IFNULL(:maxCreatedDate, '') = '' OR c.DateCreated <= :maxCreatedDate)
    ;

    CREATE TEMPORARY TABLE TEMP_SA_ShipTo
    (
        ARDivisionNo VARCHAR(2),
        CustomerNo   VARCHAR(20),
        ShipToCode   VARCHAR(4),
        PRIMARY KEY (ARDivisionNo, CustomerNo, ShipToCode)
    );
    INSERT INTO TEMP_SA_ShipTo (ARDivisionNo, CustomerNo, ShipToCode)
    SELECT c.ARDivisionNo, c.CustomerNo, st.ShipToCode
    FROM c2.ar_customer c
        INNER JOIN TEMP_SA_Customers ct ON c.ARDivisionNo = ct.ARDivisionNo AND c.CustomerNo = ct.CustomerNo
             INNER JOIN c2.SO_ShipToAddress st
                        ON c.Company = st.Company AND 
                           c.ARDivisionNo = st.ARDivisionNo AND 
                           c.CustomerNo = st.CustomerNo
    WHERE c.Company = 'chums'; 
`;
