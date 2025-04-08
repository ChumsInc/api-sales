import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
import {loadPromoCodes} from './promo_code.js';

const debug = Debug('chums:lib:b2b:account');

const loadAccount = async ({ARDivisionNo, CustomerNo, userid}) => {
    try {
        const query = `SELECT 'chums'                                               AS Company,
                              c.ARDivisionNo,
                              c.CustomerNo,
                              c.CustomerName,
                              IFNULL(c.AddressLine1, '')                            AS AddressLine1,
                              IFNULL(c.AddressLine2, '')                            AS AddressLine2,
                              IFNULL(c.AddressLine3, '')                            AS AddressLine3,
                              IFNULL(c.City, '')                                    AS City,
                              IFNULL(c.State, '')                                   AS State,
                              c.ZipCode,
                              c.CountryCode,
                              IFNULL(c.TelephoneNo, '')                             AS TelephoneNo,
                              IFNULL(c.TelephoneExt, '')                            AS TelephoneExt,
                              IFNULL(c.EmailAddress, '')                            AS EmailAddress,
                              IFNULL(c.URLAddress, '')                              AS URLAddress,
                              c.ContactCode,
                              c.ShipMethod,
                              c.TaxSchedule                                         AS TaxSchedule,
                              c.DefaultPaymentType,
                              IF(bs.TermsCode = 'B',
                                 IFNULL(cb.TermsCode, c.TermsCode), c.TermsCode)    AS TermsCode,
                              c.SalespersonDivisionNo,
                              c.SalespersonNo,
                              c.ResidentialAddress,
                              c.CustomerType,
                              IF(bs.CustomerPricing = 'B',
                                 IFNULL(cb.PriceLevel, c.PriceLevel), c.PriceLevel) AS PriceLevel,
                              IF(bs.CreditHold = 'B',
                                 IFNULL(cb.CreditHold, c.CreditHold), c.CreditHold) AS CreditHold,
                              c.PrimaryShipToCode,
                              c.DateEstablished,
                              c.UDF_INTERNETRESELLER                                AS InternetReseller,
                              c.UDF_RESELLER                                        AS Reseller,
                              c.CustomerStatus,
                              bs.BillToDivisionNo                                   AS ParentDivisionNo,
                              bs.BillToCustomerNo                                   AS ParentCustomerNo,
                              cb.CustomerName                                       AS ParentCustomerName,
                              cb.AddressLine1                                       AS ParentAddressLine1,
                              cb.AddressLine2                                       AS ParentAddressLine2,
                              cb.AddressLine3                                       AS ParentAddressLine3,
                              cb.City                                               AS ParentCity,
                              cb.State                                              AS ParentState,
                              cb.ZipCode                                            AS ParentZipCode,
                              cb.CountryCode                                        AS ParentCountryCode
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_AR_Customer
                             WHERE (userid = :userid OR api_id = :api_id)
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)) AS a
                                INNER JOIN c2.ar_customer c
                                           ON c.Company = a.Company
                                               AND c.ARDivisionNo = a.ARDivisionNo
                                               AND c.CustomerNo = a.CustomerNo
                                LEFT JOIN c2.AR_BillToSoldTo bs
                                          ON bs.SoldToDivisionNo = c.ARDivisionNo AND
                                             bs.SoldToCustomerNo = c.CustomerNo
                                LEFT JOIN c2.ar_customer cb
                                          ON cb.Company = c.Company AND
                                             cb.ARDivisionNo = bs.BillToDivisionNo AND
                                             cb.CustomerNo = bs.BillToCustomerNo
                       WHERE c.Company = 'chums'
                         AND c.ARDivisionNo = :ARDivisionNo
                         AND c.CustomerNo = :CustomerNo`;
        const api_id = userid * -1;
        const data = {ARDivisionNo, CustomerNo, userid, api_id};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadAccount()", err.message);
        return Promise.reject(err);
    }
};

const loadShipToAddresses = async ({ARDivisionNo, CustomerNo, ShipToCode = null, userid}) => {
    try {
        const query = `SELECT s.ARDivisionNo,
                              s.CustomerNo,
                              s.ShipToCode,
                              ShipToName,
                              IFNULL(ShipToAddress1, '') AS ShipToAddress1,
                              IFNULL(ShipToAddress2, '') AS ShipToAddress2,
                              IFNULL(ShipToAddress3, '') AS ShipToAddress3,
                              IFNULL(ShipToCity, '')     AS ShipToCity,
                              IFNULL(ShipToState, '')    AS ShipToState,
                              ShipToZipCode,
                              ShipToCountryCode,
                              IFNULL(TelephoneNo, '')    AS TelephoneNo,
                              IFNULL(TelephoneExt, '')   AS TelephoneExt,
                              IFNULL(EmailAddress, '')   AS EmailAddress,
                              ContactCode,
                              SalespersonDivisionNo,
                              SalespersonNo,
                              ResidentialAddress,
                              s.UDF_RESELLER             AS Reseller
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)) AS a
                                INNER JOIN c2.SO_ShipToAddress s
                                           ON s.Company = a.Company
                                               AND s.ARDivisionNo = a.ARDivisionNo
                                               AND s.CustomerNo = a.CustomerNo
                                               AND s.ShipToCode = a.ShipToCode
                       WHERE s.Company = 'chums'
                         AND s.ARDivisionNo = :ARDivisionNo
                         AND s.CustomerNo = :CustomerNo
                         AND (s.ShipToCode = :ShipToCode OR :ShipToCode IS NULL)`;
        const api_id = userid * -1;
        const data = {ARDivisionNo, CustomerNo, userid, api_id, ShipToCode};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadShipToAddresses()", err.message);
        return Promise.reject(err);
    }
};

const loadPricing = async ({ARDivisionNo, CustomerNo, PriceLevel = '',}) => {
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
        const data = {ARDivisionNo, CustomerNo, PriceLevel};
        // debug('loadPricing()', data);
        const [rows] = await mysql2Pool.query(query, data);

        rows.forEach(row => row.DiscountMarkup1 = Number(row.DiscountMarkup1));
        return rows;
    } catch (err) {
        debug("loadPricing()", err.message);
        return Promise.reject(err);
    }
};

const loadContacts = async ({ARDivisionNo, CustomerNo, ContactCode = null, userid}) => {
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
                             WHERE (userid = :userid OR api_id = :api_id)) AS a
                                INNER JOIN c2.AR_CustomerContact c
                                           ON c.Company = a.Company
                                               AND c.ARDivisionNo = a.ARDivisionNo
                                               AND c.CustomerNo = a.CustomerNo
                       WHERE c.Company = 'chums'
                         AND c.ARDivisionNo = :ARDivisionNo
                         AND c.CustomerNo = :CustomerNo
                         AND (c.ContactCode = :ContactCode OR :ContactCode IS NULL)`;
        const api_id = userid * -1;
        const data = {ARDivisionNo, CustomerNo, userid, api_id, ContactCode};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadContacts()", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {String} ARDivisionNo
 * @param {String} CustomerNo
 * @param {boolean} isRepAccount
 * @param {Number} userid - User ID of person requesting the data
 * @return {Promise<Promise<*|*|undefined>|*>}
 */
async function loadCustomerUsers({ARDivisionNo, CustomerNo, isRepAccount = false, userid = 0}) {
    try {
        // debug('loadCustomerUsers()', {Company, ARDivisionNo, CustomerNo, isRepAccount, userid});
        const query = `SELECT u.id,
                              u.name,
                              u.company,
                              u.email,
                              u.accountType,
                              IFNULL(b.billTo, 0) AS billTo,
                              IF(b.billTo = 1,
                                 JSON_EXTRACT('[]', '$'),
                                 IFNULL(s.shipToCode, JSON_EXTRACT('[]', '$'))
                              )                   AS shipToCode
                       FROM (SELECT DISTINCT ua.id AS userid
                             FROM users.user_AR_Customer a
                                      INNER JOIN users.users cu ON cu.id = :userid
                                      INNER JOIN users.accounts aa ON aa.id = a.accountAccessId
                                      INNER JOIN users.users ua ON ua.id = a.userid
                             WHERE a.Company = 'chums'
                               AND a.ARDivisionNo = :ARDivisionNo
                               AND a.CustomerNo = :CustomerNo
                               AND ua.active = 1
                               AND ua.accountType >= cu.accountType
                               AND (aa.isRepAccount = 0 OR ua.accountType > cu.accountType)

                             UNION

                             SELECT DISTINCT ua.id AS userid
                             FROM users.user_SO_ShipToAddress sta
                                      INNER JOIN users.user_SO_ShipToAddress cua
                                                 USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
                                      INNER JOIN users.users ua ON ua.id = sta.userid
                                      INNER JOIN users.users cu ON cua.userid = cu.id
                             WHERE cua.userid = :userid
                               AND cua.Company = 'chums'
                               AND cua.ARDivisionNo = :ARDivisionNo
                               AND cua.CustomerNo = :CustomerNo
                               AND ua.active = 1
                               AND ua.accountType >= cu.accountType
                               AND ua.accountType <> 1

                             ORDER BY userid) cu
                                INNER JOIN users.users u ON u.id = cu.userid
                                LEFT JOIN (SELECT DISTINCT userid, 1 AS billTo
                                           FROM users.user_AR_Customer a
                                           WHERE a.Company = 'chums'
                                             AND ARDivisionNo = :ARDivisionNo
                                             AND CustomerNo = :CustomerNo
                                           ORDER BY userid) b ON b.userid = cu.userid
                                LEFT JOIN (SELECT sta.userid,
                                                  JSON_ARRAYAGG(DISTINCT sta.ShipToCode) AS shipToCode,
                                                  stu.email
                                           FROM users.user_SO_ShipToAddress sta
                                                    INNER JOIN users.users stu ON stu.id = sta.userid
                                                    INNER JOIN users.accounts ua ON ua.userid = stu.id
                                           WHERE sta.Company = 'chums'
                                             AND sta.ARDivisionNo = :ARDivisionNo
                                             AND sta.CustomerNo = :CustomerNo
                                           GROUP BY userid) s ON s.userid = cu.userid
                       ORDER BY id`;
        const data = {ARDivisionNo, CustomerNo, userid};

        const [rows] = await mysql2Pool.query(query, data);

        return rows.map(row => {
            return {
                ...row,
                billTo: !!row.billTo,
                shipToCode: JSON.parse(row.shipToCode ?? '[]'),
            }
        });
    } catch (err) {
        debug("loadCustomerUsers()", err.message);
        return Promise.reject(err);
    }
}

const loadCustomerCreditCards = async ({ARDivisionNo, CustomerNo, userid}) => {
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
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_AR_Customer
                             WHERE (userid = :userid OR api_id = :api_id)
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)) AS a
                                INNER JOIN c2.AR_CustomerCreditCard c
                                           ON c.Company = a.Company
                                               AND c.ARDivisionNo = a.ARDivisionNo
                                               AND c.CustomerNo = a.CustomerNo
                       WHERE c.Company = 'chums'
                         AND c.ARDivisionNo = :ARDivisionNo
                         AND c.CustomerNo = :CustomerNo
                         AND (ExpirationDateYear > YEAR(NOW()) OR
                              (ExpirationDateYear = YEAR(NOW()) AND ExpirationDateMonth >= MONTH(NOW()))
                           )`;
        const api_id = userid * -1;
        const data = {ARDivisionNo, CustomerNo, userid, api_id};

        const [rows] = await mysql2Pool.query(query, data);

        return rows;
    } catch (err) {
        debug("loadCustomerCreditCards()", err.message);
        return Promise.reject(err);
    }
};

const loadCustomer = async ({ARDivisionNo, CustomerNo, userid}) => {
    try {
        const [customer] = await loadAccount({ARDivisionNo, CustomerNo, userid});
        if (!customer) {
            return {error: 'Account not available.', status: 401};
        }
        const [shipTo, contacts, pricing, users, paymentCards, promoCodes] = await Promise.all([
            loadShipToAddresses({
                ARDivisionNo: customer.ARDivisionNo,
                CustomerNo: customer.CustomerNo,
                userid
            }),
            loadContacts({
                ARDivisionNo: customer.ARDivisionNo,
                CustomerNo: customer.CustomerNo,
                userid
            }),
            loadPricing({
                ARDivisionNo: customer.ParentDivisionNo ?? customer.ARDivisionNo,
                CustomerNo: customer.ParentCustomerNo ?? customer.CustomerNo,
                PriceLevel: customer.PriceLevel
            }),
            loadCustomerUsers({
                ARDivisionNo: customer.ARDivisionNo,
                CustomerNo: customer.CustomerNo,
                userid
            }),
            loadCustomerCreditCards({
                ARDivisionNo: customer.ARDivisionNo,
                CustomerNo: customer.CustomerNo,
                userid
            }),
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

export const getCustomer = async (req, res) => {
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

export const getCustomerV2 = async (req, res) => {
    try {
        const {customerKey} = req.params
        const [ARDivisionNo, CustomerNo] = customerKey.split('-');
        const userid = res.locals.profile.user.id;
        const result = await loadCustomer({ARDivisionNo, CustomerNo, userid});
        if (result.error) {
            return res.json(result);
        }
        res.json({result});
    } catch (err) {
        if (err instanceof Error) {
            debug("getCustomerV2()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getCustomerV2'});
    }
}
