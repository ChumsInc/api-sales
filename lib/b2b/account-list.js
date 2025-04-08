/**
 * Created by steve on 3/1/2017.
 */
import Debug from "debug";
import {getDBCompany, mysql2Pool} from 'chums-local-modules';

const debug = Debug('chums:lib:b2b:account-list');

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
                                     a.ShipToName        AS CustomerName,
                                     a.ShipToAddress1    AS AddressLine1,
                                     a.ShipToCity        AS City,
                                     a.ShipToState       AS State,
                                     a.ShipToZipCode     AS ZipCode,
                                     a.ShipToCountryCode AS CountryCode,
                                     a.TelephoneNo,
                                     a.EmailAddress,
                                     a.SalespersonDivisionNo,
                                     a.SalespersonNo,
                                     c.CustomerName as BillToName
                     FROM users.user_SO_ShipToAddress a
                              INNER JOIN c2.ar_salesperson rep
                                         ON rep.Company = a.Company AND
                                            rep.SalespersonDivisionNo = a.SalespersonDivisionNo AND
                                            rep.SalespersonNo = a.SalespersonNo
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = a.Company AND
                                            c.ARDivisionNo = a.ARDivisionNo AND
                                            c.CustomerNo = a.CustomerNo
                     WHERE a.Company = 'chums'
                       AND ((:userid > 0 AND a.userid = :userid) OR (:userid < 0 AND a.api_id = -1 * :userid))
                       AND (ifnull(:SalespersonDivisionNo, '') = '' OR rep.SalespersonDivisionNo LIKE :SalespersonDivisionNo)
                       AND (ifnull(:SalespersonNo, '') = '' OR rep.SalespersonNo LIKE :SalespersonNo)
                       AND c.CustomerStatus = 'A'
                       AND NOT(c.SalespersonDivisionNo = a.SalespersonDivisionNo AND c.SalespersonNo = a.SalespersonNo)
                     ORDER BY ARDivisionNo, CustomerNo, ShipToCode`;
        const data = {
            userid: params.user.id,
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
                                     c.SalespersonNo,
                                     c.CustomerName as BillToName
                     FROM users.user_AR_Customer c
                              INNER JOIN c2.ar_salesperson rep
                                         ON rep.Company = c.Company
                                             AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                             AND rep.SalespersonNo = c.SalespersonNo
                     WHERE c.Company = 'chums'
                       AND ((:userid > 0 AND c.userid = :userid) OR (:userid < 0 AND c.api_id = -1 * :userid))
                       AND (ifnull(:SalespersonDivisionNo, '') = '' OR rep.SalespersonDivisionNo LIKE :SalespersonDivisionNo)
                       AND (ifnull(:SalespersonNo, '') = '' OR rep.SalespersonNo LIKE :SalespersonNo)
                       AND c.CustomerStatus = 'A'
                     ORDER BY ARDivisionNo, CustomerNo`;
        const data = {
            userid: params.user.id,
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

export const getRepAccountList = async (req, res) => {
    try {
        const params = {
            user: res.locals.profile.user,
            ...req.params,
        };
        if (!params.SalespersonDivisionNo && req.params.salespersonSlug) {
            const [SalespersonDivisionNo, SalespersonNo] = req.params.salespersonSlug.split('-');
            params.SalespersonDivisionNo = SalespersonDivisionNo;
            params.SalespersonNo = SalespersonNo;
        }
        const result = await loadAccountList(params);
        res.json({result});
    } catch (err) {
        debug("getRepAccountList()", err.message);
        res.status(500).json({error: err.message});
    }
};
