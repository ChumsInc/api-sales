export const sqlGLAccounts = `
    CREATE TEMPORARY TABLE IF NOT EXISTS TEMP_SA_Accounts
    (
        AccountKey VARCHAR(9),
        PRIMARY KEY (AccountKey)
    );

    INSERT INTO TEMP_SA_Accounts (AccountKey)
    SELECT AccountKey
    FROM c2.gl_account
    WHERE (
        (REPLACE(Account, '-', '') LIKE IFNULL(:SalesAccount, '') OR Account LIKE IFNULL(:SalesAccount, ''))
            OR (REPLACE(Account, '-', '') LIKE IFNULL(:CostAccount, '') OR Account LIKE IFNULL(:CostAccount, ''))
        );
`;
