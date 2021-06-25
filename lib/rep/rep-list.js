const debug = require('debug')('chums:lib:sales:rep:rep-list');
const {mysql2Pool, getDBCompany} = require('chums-local-modules');

/**
 * Loads a list of reps available to the user (SalespersonDivisionNo, SalespersonNo)
 * @param {string} company
 * @param {string|number} userid
 * @return {Promise<*>}
 */
async function loadRepList({company, userid}) {
    try {
        company = getDBCompany(company);

        const query = `
            SELECT rep.Company,
                   rep.SalespersonDivisionNo,
                   rep.SalespersonNo,
                   rep.SalespersonName,
                   IFNULL(rep.UDF_TERMINATED, 'N') = 'N' AS active
            FROM c2.ar_salesperson rep
                 INNER JOIN users.accounts a
                            ON rep.Company = a.Company
                                AND (
                                       (
                                               rep.SalespersonDivisionNo LIKE a.SalespersonDivisionNo
                                               AND rep.SalespersonNo LIKE a.SalespersonNo
                                           )
                                       OR (
                                               rep.SalesmanagerDivisionNo LIKE a.SalespersonDivisionNo
                                               AND rep.SalesmanagerNo LIKE a.SalespersonNo
                                           )
                                   )
            WHERE (a.userid = :userid OR a.api_id = :api_id)
              AND a.isRepAccount = 1
              AND a.company LIKE :company
              AND rep.SalespersonDivisionNo NOT IN ('00')
            GROUP BY rep.Company, rep.SalespersonDivisionNo, rep.SalespersonNo
            ORDER BY rep.Company DESC, rep.SalespersonDivisionNo, rep.SalespersonNo`;
        const data = {company, userid, api_id: userid * -1};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
}

/**
 * Loads a list of reps available to the user, grouped by SalespersonNo (no SalespersonDivisionNo)
 * @param {string} company
 * @param {string|number} userid
 * @return {Promise<*>}
 */

async function loadCondensedRepList({company, userid}) {
    try {
        company = getDBCompany(company);

        const query = `
            SELECT rep.Company,
                   '%'                                   AS SalespersonDivisionNo,
                   rep.SalespersonNo,
                   rep.SalespersonName,
                   IFNULL(rep.UDF_TERMINATED, 'N') = 'N' AS active
            FROM c2.ar_salesperson rep
                 INNER JOIN users.accounts a
                            ON rep.Company = a.Company
                                AND (
                                       (
                                               rep.SalespersonDivisionNo LIKE a.SalespersonDivisionNo
                                               AND rep.SalespersonNo LIKE a.SalespersonNo
                                           )
                                       OR (
                                               rep.SalesmanagerDivisionNo LIKE a.SalespersonDivisionNo
                                               AND rep.SalesmanagerNo LIKE a.SalespersonNo
                                           )
                                   )
                 INNER JOIN (
                            SELECT DISTINCT Company, SalespersonDivisionNo, SalespersonNo
                            FROM c2.ar_customer c
                            WHERE CustomerStatus = 'A'
                            UNION
                            SELECT DISTINCT d.Company, d.SalespersonDivisionNo, d.SalespersonNo
                            FROM c2.ar_customer c
                                 INNER JOIN c2.so_shiptoaddress d
                                            ON d.Company = c.Company AND d.ARDivisionNo = c.ARDivisionNo AND
                                               d.CustomerNo = c.CustomerNo
                            WHERE CustomerStatus = 'A'
                            ) cust
                            ON cust.Company = rep.Company
                                AND cust.SalespersonDivisionNo = rep.SalespersonDivisionNo
                                AND cust.SalespersonNo = rep.SalespersonNo
            WHERE (a.userid = :userid OR a.api_id = :api_id)
              AND a.isRepAccount = 1
              AND a.company LIKE :company
              AND rep.SalespersonDivisionNo NOT IN ('00')
            GROUP BY rep.Company, rep.SalespersonNo
            ORDER BY rep.Company DESC, rep.SalespersonNo`;
        const data = {company, userid, api_id: userid * -1};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadCondensed()", err.message);
        return Promise.reject(err);
    }
}


const getRepList = async (req, res) => {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const list = await loadRepList({...req.params, userid});
        res.json({list});
    } catch (err) {
        debug("getRepList()", err.message);
        res.json({error: err.message});
    }
};

const getCondensedRepList = async (req, res) => {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const list = await loadCondensedRepList({...req.params, userid});
        res.json({list});
    } catch (err) {
        debug("getCondensedRepList()", err.message);
        return Promise.reject(err);
    }
};

const getUserRepList = async (req, res) => {
    try {
        const list = await loadRepList({...req.params});
        res.json({list});
    } catch (err) {
        debug("getUserRepList()", err.message);
        res.json({error: err.message});
    }
    loadRepList({...req.params})
        .then(list => {
            res.json({list});
        })
        .catch(err => {

        })
};

exports.getRepList = getRepList;
exports.getCondensedRepList = getCondensedRepList;
exports.getUserRepList = getUserRepList;
exports.loadRepList = loadRepList;
exports.loadCondensedRepList = loadCondensedRepList;
