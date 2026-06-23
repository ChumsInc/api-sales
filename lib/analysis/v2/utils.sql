CREATE TABLE IF NOT EXISTS c2.TEMP_SA_Customers
(
    ARDivisionNo VARCHAR(2),
    CustomerNo   VARCHAR(20),
    PRIMARY KEY (ARDivisionNo, CustomerNo)
);
CREATE TABLE IF NOT EXISTS c2.TEMP_SA_Items
(
    ItemCode VARCHAR(30),
    PRIMARY KEY (ItemCode)
);
CREATE TABLE IF NOT EXISTS c2.TEMP_SA_Accounts
(
    AccountKey VARCHAR(9),
    PRIMARY KEY (AccountKey)
);
