const {mysql2Pool, getCompany} = require('chums-local-modules');
const debug = require('debug')('chums:lib:b2b:account');

const loadAccount = async ({Company, ARDivisionNo, CustomerNo, userid}) => {
    try {
        const query = `SELECT :Company             AS Company,
                              c.ARDivisionNo,
                              c.CustomerNo,
                              CustomerName,
                              AddressLine1,
                              AddressLine2,
                              AddressLine3,
                              City,
                              State,
                              ZipCode,
                              CountryCode,
                              TelephoneNo,
                              TelephoneExt,
                              EmailAddress,
                              URLAddress,
                              ContactCode,
                              ShipMethod,
                              TaxSchedule,
                              DefaultPaymentType,
                              TermsCode,
                              SalespersonDivisionNo,
                              SalespersonNo,
                              ResidentialAddress,
                              CustomerType,
                              PriceLevel,
                              CreditHold,
                              PrimaryShipToCode,
                              DateEstablished,
                              UDF_INTERNETRESELLER AS InternetReseller,
                              UDF_RESELLER         AS Reseller,
                              CustomerStatus
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_AR_Customer
                             WHERE (userid = :userid OR api_id = :api_id)
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)
                            ) AS a
                            INNER JOIN c2.ar_customer c
                                       ON c.Company = a.Company
                                           AND c.ARDivisionNo = a.ARDivisionNo
                                           AND c.CustomerNo = a.CustomerNo
                       WHERE c.Company = :Company
                         AND c.ARDivisionNo = :ARDivisionNo
                         AND c.CustomerNo = :CustomerNo`;
        const api_id = userid * -1;
        const data = {Company, ARDivisionNo, CustomerNo, userid, api_id};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch (err) {
        debug("loadAccount()", err.message);
        return Promise.reject(err);
    }
};

const loadShipToAddresses = async ({Company, ARDivisionNo, CustomerNo, ShipToCode = null, userid}) => {
    try {
        const query = `SELECT s.ARDivisionNo,
                              s.CustomerNo,
                              s.ShipToCode,
                              ShipToName,
                              ShipToAddress1,
                              ShipToAddress2,
                              ShipToAddress3,
                              ShipToCity,
                              ShipToState,
                              ShipToZipCode,
                              ShipToCountryCode,
                              TelephoneNo,
                              TelephoneExt,
                              EmailAddress,
                              ContactCode,
                              SalespersonDivisionNo,
                              SalespersonNo,
                              ResidentialAddress,
                              Reseller
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)
                            ) AS a
                            INNER JOIN c2.so_shiptoaddress s
                                       ON s.Company = a.Company
                                           AND s.ARDivisionNo = a.ARDivisionNo
                                           AND s.CustomerNo = a.CustomerNo
                                           AND s.ShipToCode = a.ShipToCode
                       WHERE s.Company = :Company
                         AND s.ARDivisionNo = :ARDivisionNo
                         AND s.CustomerNo = :CustomerNo
                         AND (s.ShipToCode = :ShipToCode OR :ShipToCode IS NULL)`;
        const api_id = userid * -1;
        const data = {Company, ARDivisionNo, CustomerNo, userid, api_id, ShipToCode};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch (err) {
        debug("loadShipToAddresses()", err.message);
        return Promise.reject(err);
    }
};

const loadContacts = async ({Company, ARDivisionNo, CustomerNo, ContactCode = null, userid}) => {
    try {
        const query = `SELECT c.ARDivisionNo,
                              c.CustomerNo,
                              ContactCode,
                              ContactName,
                              AddressLine1,
                              AddressLine2,
                              AddressLine3,
                              City,
                              State,
                              ZipCode,
                              CountryCode,
                              TelephoneNo1,
                              TelephoneExt1,
                              EmailAddress,
                              ContactTitle
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_AR_Customer
                             WHERE (userid = :userid OR api_id = :api_id)
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)
                            ) AS a
                            INNER JOIN c2.AR_CustomerContact c
                                       ON c.Company = a.Company
                                           AND c.ARDivisionNo = a.ARDivisionNo
                                           AND c.CustomerNo = a.CustomerNo
                       WHERE c.Company = :Company
                         AND c.ARDivisionNo = :ARDivisionNo
                         AND c.CustomerNo = :CustomerNo
                         AND (c.ContactCode = :ContactCode OR :ContactCode IS NULL)`;
        const api_id = userid * -1;
        const data = {Company, ARDivisionNo, CustomerNo, userid, api_id, ContactCode};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch (err) {
        debug("loadContacts()", err.message);
        return Promise.reject(err);
    }
};

const loadPricing = async ({Company, ARDivisionNo, CustomerNo, PriceLevel = ''}) => {
    try {
        const query = `SELECT PriceCode, ItemCode, PricingMethod, DiscountMarkup1
                       FROM c2.im_pricecode
                       WHERE Company = :Company
                         AND ((PriceCodeRecord = '2' AND ARDivisionNo = :ARDivisionNo AND CustomerNo = :CustomerNo)
                           OR (PriceCodeRecord = '0' AND CustomerPriceLevel = :PriceLevel))
                       ORDER BY PriceCode, ItemCode`;
        const data = {Company, ARDivisionNo, CustomerNo, PriceLevel};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        rows.forEach(row => row.DiscountMarkup1 = Number(row.DiscountMarkup1));
        return rows;
    } catch (err) {
        debug("loadPricing()", err.message);
        return Promise.reject(err);
    }
};


const loadCustomer = async ({Company, ARDivisionNo, CustomerNo, userid}) => {
    try {
        const [customer] = await loadAccount({Company, ARDivisionNo, CustomerNo, userid});
        const shipTo = await loadShipToAddresses({Company, ARDivisionNo, CustomerNo, userid});
        const contacts = await loadContacts({Company, ARDivisionNo, CustomerNo, userid});
        const pricing = await loadPricing({Company, ARDivisionNo, CustomerNo, PriceLevel: customer.PriceLevel});
        return {
            customer,
            contacts,
            shipTo,
            pricing,
        };
    } catch (err) {
        debug("loadCustomer()", err.message);
        return Promise.reject(err);
    }
};

exports.getCustomer = async (req, res) => {
    try {
        const params = {
            ...req.params,
            userid: res.locals.profile.user.id
        };
        const result = await loadCustomer(params);
        res.json({result});
    } catch(err) {
        debug("getCustomer()", err.message);
        res.status(500).json({...err, message: err.message});
    }
};
