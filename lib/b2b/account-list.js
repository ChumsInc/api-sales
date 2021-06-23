/**
 * Created by steve on 3/1/2017.
 */

const debug = require('debug')('chums:lib:b2b:account-list');
const {mysql2Pool, getDBCompany} = require('chums-local-modules');

const accountSort = (a, b) => {
    return a.Company === b.Company
        ? (
            a.ARDivisionNo === b.ARDivisionNo
                ? (
                    a.CustomerNo === b.CustomerNo
                        ? (
                            a.ShipToCode === b.ShipToCode
                                ? 0
                                : (a.ShipToCode > b.ShipToCode ? 1 : -1)
                        )
                        : (a.CustomerNo > b.CustomerNo ? 1 : -1)
                )
                : (a.ARDivisionNo > b.ARDivisionNo ? 1 : -1)
        )
        : (a.Company > b.Company ? -1 : 1);
};

const loadShipToAccountList = async (params) => {
    try {
        const sql = `SELECT DISTINCT a.Company,
                                     a.ARDivisionNo,
                                     a.CustomerNo,
                                     a.ShipToCode,
                                     a.ShipToName,
                                     a.ShipToAddress1,
                                     a.ShipToCity,
                                     a.ShipToState,
                                     a.ShipToZipCode,
                                     a.ShipToCountryCode,
                                     a.TelephoneNo,
                                     a.EmailAddress,
                                     a.SalespersonDivisionNo,
                                     a.SalespersonNo
                     FROM users.user_SO_ShipToAddress a
                          INNER JOIN c2.ar_salesperson rep
                                     ON rep.Company = a.Company
                                         AND rep.SalespersonDivisionNo = a.SalespersonDivisionNo
                                         AND rep.SalespersonNo = a.SalespersonNo
                          INNER JOIN c2.ar_customer c
                                     ON c.Company = a.Company
                                         AND c.ARDivisionNo = a.ARDivisionNo
                                         AND c.CustomerNo = a.CustomerNo
                          LEFT JOIN  (
                                     SELECT a.userid,
                                            a.api_id,
                                            a.Company,
                                            a.ARDivisionNo,
                                            a.CustomerNo,
                                            a.SalespersonDivisionNo,
                                            a.SalespersonNo
                                     FROM users.user_AR_Customer a
                                          INNER JOIN c2.ar_salesperson rep
                                                     ON rep.Company = a.Company
                                                         AND rep.SalespersonDivisionNo = a.SalespersonDivisionNo
                                                         AND rep.SalespersonNo = a.SalespersonNo
                                     WHERE a.Company = :Company
                                       AND ((:userid > 0 AND a.userid = :userid) OR
                                            (:userid < 0 AND a.api_id = -1 * :userid))
                                       AND (
                                             (rep.SalespersonDivisionNo LIKE :SalespersonDivisionNo
                                                 AND rep.SalespersonNo LIKE :SalespersonNo)
                                             OR
                                             (rep.SalesmanagerDivisionNo LIKE :SalespersonDivisionNo
                                                 AND rep.SalesmanagerNo LIKE :SalespersonNo)
                                         )
                                       AND a.CustomerStatus = 'A'
                                     ) uc
                                     ON uc.userid = a.userid AND uc.api_id = a.api_id
                                         AND uc.Company = a.Company
                                         AND uc.ARDivisionNo = a.ARDivisionNo
                                         AND uc.CustomerNo = a.CustomerNo
                                         AND ((:userid > 0 AND uc.userid = :userid) OR
                                              (:userid < 0 AND uc.api_id = -1 * :userid))

                     WHERE a.Company = :Company
                       AND ((:userid > 0 AND a.userid = :userid) OR (:userid < 0 AND a.api_id = -1 * :userid))
                       AND (
                             (rep.SalespersonDivisionNo LIKE :SalespersonDivisionNo
                                 AND rep.SalespersonNo LIKE :SalespersonNo)
                             OR
                             (rep.SalesmanagerDivisionNo LIKE :SalespersonDivisionNo
                                 AND rep.SalesmanagerNo LIKE :SalespersonNo)
                         )
                       AND NOT (IFNULL(uc.SalespersonDivisionNo, '') = a.SalespersonDivisionNo AND
                                IFNULL(uc.SalespersonNo, '') = a.SalespersonNo)
                       AND c.CustomerStatus = 'A'
                     ORDER BY Company, ARDivisionNo, CustomerNo, ShipToCode`;
        const data = {
            userid: params.user.id,
            Company: getDBCompany(params.Company),
            SalespersonDivisionNo: params.SalespersonDivisionNo,
            SalespersonNo: params.SalespersonNo
        };

        const [rows] = await mysql2Pool.query(sql, data);

        return rows;
    } catch (err) {
        debug("loadShipToAccountList()", err.message);
        return Promise.reject(err);
    }

};

async function loadAccountList(params) {
    try {
        const sql = `SELECT DISTINCT c.Company,
                                     c.ARDivisionNo,
                                     c.CustomerNo,
                                     NULL AS ShipToCode,
                                     c.CustomerName,
                                     c.AddressLine1,
                                     c.City,
                                     c.State,
                                     c.ZipCode,
                                     c.CountryCode,
                                     c.TelephoneNo,
                                     c.EmailAddress,
                                     c.SalespersonDivisionNo,
                                     c.SalespersonNo
                     FROM users.user_AR_Customer c
                          INNER JOIN c2.ar_salesperson rep
                                     ON rep.Company = c.Company
                                         AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                         AND rep.SalespersonNo = c.SalespersonNo
                     WHERE c.Company = :Company
                       AND ((:userid > 0 AND c.userid = :userid) OR (:userid < 0 AND c.api_id = -1 * :userid))
                       AND (
                             (rep.SalespersonDivisionNo LIKE :SalespersonDivisionNo
                                 AND rep.SalespersonNo LIKE :SalespersonNo)
                             OR
                             (rep.SalesmanagerDivisionNo LIKE :SalespersonDivisionNo
                                 AND rep.SalesmanagerNo LIKE :SalespersonNo)
                         )
                       AND c.CustomerStatus = 'A'
                     ORDER BY Company, ARDivisionNo, CustomerNo, ShipToCode`;
        const data = {
            userid: params.user.id,
            Company: getDBCompany(params.Company),
            SalespersonDivisionNo: params.SalespersonDivisionNo,
            SalespersonNo: params.SalespersonNo
        };

        const [rows] = await mysql2Pool.query(sql, data);

        const shipToAccounts = params.SalespersonDivisionNo === '%' && params.SalespersonNo === '%'
            ? []
            : await loadShipToAccountList(params);
        return [...rows, ...shipToAccounts]
            .sort(accountSort);
    } catch (err) {
        debug('loadAccountList()', err.message);
        return Promise.reject(err);
    }
}

exports.getRepAccountList = async (req, res) => {
    try {
        const params = {
            user: res.locals.profile.user,
            ...req.params,
        };
        const result = await loadAccountList(params);
        res.json({result});
    } catch (err) {
        debug("getRepAccountList()", err.message);
        res.status(500).json({error: err.message});
    }
};
