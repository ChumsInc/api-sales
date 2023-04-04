const {mysql2Pool, getCompany} = require('chums-local-modules');
const debug = require('debug')('chums:lib:b2b:account');
const {loadPromoCodes} = require('./promo_code');

const loadAccount = async ({Company, ARDivisionNo, CustomerNo, userid}) => {
    try {
        const query = `SELECT :Company                 AS Company,
                              c.ARDivisionNo,
                              c.CustomerNo,
                              CustomerName,
                              IFNULL(AddressLine1, '') AS AddressLine1,
                              IFNULL(AddressLine2, '') AS AddressLine2,
                              IFNULL(AddressLine3, '') AS AddressLine3,
                              IFNULL(City, '')         AS City,
                              IFNULL(State, '')        AS State,
                              ZipCode,
                              CountryCode,
                              IFNULL(TelephoneNo, '')  AS TelephoneNo,
                              IFNULL(TelephoneExt, '') AS TelephoneExt,
                              IFNULL(EmailAddress, '') AS EmailAddress,
                              IFNULL(URLAddress, '')   AS URLAddress,
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
                              UDF_INTERNETRESELLER     AS InternetReseller,
                              UDF_RESELLER             AS Reseller,
                              CustomerStatus
                       FROM (
                                SELECT DISTINCT Company, ARDivisionNo, CustomerNo
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

        const [rows] = await mysql2Pool.query(query, data);

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
                              ifnull(ShipToAddress1, '') as ShipToAddress1,
                              ifnull(ShipToAddress2, '') as ShipToAddress2,
                              ifnull(ShipToAddress3, '') as ShipToAddress3,
                              ifnull(ShipToCity, '') as ShipToCity,
                              ifnull(ShipToState, '') as ShipToState,
                              ShipToZipCode,
                              ShipToCountryCode,
                              ifnull(TelephoneNo, '') as TelephoneNo,
                              ifnull(TelephoneExt, '') as TelephoneExt,
                              ifnull(EmailAddress, '') as EmailAddress,
                              ContactCode,
                              SalespersonDivisionNo,
                              SalespersonNo,
                              ResidentialAddress,
                              Reseller
                       FROM (
                            SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
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

        const [rows] = await mysql2Pool.query(query, data);

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
                       FROM (
                            SELECT DISTINCT Company, ARDivisionNo, CustomerNo
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

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadContacts()", err.message);
        return Promise.reject(err);
    }
};

const loadPricing = async ({Company, ARDivisionNo, CustomerNo, PriceLevel = ''}) => {
    try {
        const query = `SELECT DISTINCT p.PriceCode,
                                       p.ItemCode,
                                       p.PricingMethod,
                                       p.DiscountMarkup1
                       FROM c2.im_pricecode p
                            INNER JOIN c2.ci_item i
                                       ON i.Company = p.Company AND i.PriceCode = p.PriceCode
                       WHERE p.Company = 'chums'
                         AND PriceCodeRecord = '0'
                         AND i.ProductType <> 'D'
                         AND p.CustomerPriceLevel = :PriceLevel

                       UNION

                       SELECT DISTINCT p.PriceCode,
                                       p.ItemCode,
                                       p.PricingMethod,
                                       p.DiscountMarkup1
                       FROM c2.im_pricecode p
                            INNER JOIN c2.ci_item i
                                       ON i.Company = p.Company AND i.ItemCode = p.ItemCode
                       WHERE p.Company = 'chums'
                         AND PriceCodeRecord = '1'
                         AND i.ProductType <> 'D'
                         AND p.CustomerPriceLevel = :PriceLevel

                       UNION

                       SELECT DISTINCT p.PriceCode,
                                       p.ItemCode,
                                       p.PricingMethod,
                                       p.DiscountMarkup1
                       FROM c2.im_pricecode p
                            INNER JOIN c2.ci_item i
                                       ON i.Company = p.Company AND i.ItemCode = p.ItemCode
                       WHERE p.Company = 'chums'
                         AND PriceCodeRecord = '2'
                         AND i.ProductType <> 'D'
                         AND ARDivisionNo = :ARDivisionNo
                         AND CustomerNo = :CustomerNo

                       ORDER BY PriceCode, ItemCode`;
        const data = {Company, ARDivisionNo, CustomerNo, PriceLevel};
        // debug('loadPricing()', data);
        const [rows] = await mysql2Pool.query(query, data);

        rows.forEach(row => row.DiscountMarkup1 = Number(row.DiscountMarkup1));
        return rows;
    } catch (err) {
        debug("loadPricing()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {String} Company
 * @param {String} ARDivisionNo
 * @param {String} CustomerNo
 * @param {boolean} isRepAccount
 * @param {Number} userid - User ID of person requesting the data
 * @return {Promise<Promise<*|*|undefined>|*>}
 */
async function loadCustomerUsers({Company, ARDivisionNo, CustomerNo, isRepAccount = false, userid = 0}) {
    try {
        // debug('loadCustomerUsers()', {Company, ARDivisionNo, CustomerNo, isRepAccount, userid});
        const query = `SELECT u.id, u.name, u.email, u.accountType
                       FROM users.accounts a
                            INNER JOIN users.users u
                                       ON u.id = a.userid
                       WHERE a.Company = :Company
                         AND a.ARDivisionNo = :ARDivisionNo
                         AND a.CustomerNo = :CustomerNo
                         AND a.isRepAccount = :isRepAccount
                         AND u.active = 1
                         AND u.accountType >= (
                                              SELECT accountType
                                              FROM users.users
                                              WHERE id = :userid)`;
        const data = {Company, ARDivisionNo, CustomerNo, isRepAccount: isRepAccount ? 1 : 0, userid};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadCustomerUsers()", err.message);
        return Promise.reject(err);
    }
}

const loadCustomerCreditCards = async ({Company, ARDivisionNo, CustomerNo, userid}) => {
    try {
        const query = `SELECT c.ARDivisionNo,
                              c.CustomerNo,
                              c.PaymentType,
                              c.ExpirationDateYear,
                              c.ExpirationDateMonth,
                              c.Last4UnencryptedCreditCardNos,
                              c.CardType,
                              c.CreditCardGUID,
                              c.CreditCardID
                       FROM (
                            SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                            FROM users.user_AR_Customer
                            WHERE (userid = :userid OR api_id = :api_id)
                            UNION
                            SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                            FROM users.user_SO_ShipToAddress
                            WHERE (userid = :userid OR api_id = :api_id)
                            ) AS a
                            INNER JOIN c2.AR_CustomerCreditCard c
                                       ON c.Company = a.Company
                                           AND c.ARDivisionNo = a.ARDivisionNo
                                           AND c.CustomerNo = a.CustomerNo
                       WHERE c.Company = :Company
                         AND c.ARDivisionNo = :ARDivisionNo
                         AND c.CustomerNo = :CustomerNo
                         AND (ExpirationDateYear > YEAR(NOW()) OR
                              (ExpirationDateYear = YEAR(NOW()) AND ExpirationDateMonth <= MONTH(NOW()))
                           )`;
        const api_id = userid * -1;
        const data = {Company, ARDivisionNo, CustomerNo, userid, api_id};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadCustomerCreditCards()", err.message);
        return Promise.reject(err);
    }
};

const loadCustomer = async ({Company, ARDivisionNo, CustomerNo, userid}) => {
    try {
        const [customer] = await loadAccount({Company, ARDivisionNo, CustomerNo, userid});
        if (!customer) {
            return {error: 'Account not available.', status: 401};
        }
        const [shipTo, contacts, pricing, users, paymentCards, promoCodes] = await Promise.all([
            loadShipToAddresses({Company, ARDivisionNo, CustomerNo, userid}),
            loadContacts({Company, ARDivisionNo, CustomerNo, userid}),
            loadPricing({Company, ARDivisionNo, CustomerNo, PriceLevel: customer.PriceLevel}),
            loadCustomerUsers({Company, ARDivisionNo, CustomerNo, userid}),
            loadCustomerCreditCards({Company, ARDivisionNo, CustomerNo, userid}),
            loadPromoCodes({valid: true})
        ])

        return {
            customer,
            shipTo,
            contacts,
            pricing,
            users,
            paymentCards,
            promoCodes,
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
        if (result.error) {
            return res.json(result);
        }
        res.json({result});
    } catch (err) {
        debug("getCustomer()", err.message);
        res.status(500).json({...err, message: err.message});
    }
};
