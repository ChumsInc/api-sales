/**
 * Created by steve on 1/6/2017.
 */

const {mysql2Pool} = require('chums-local-modules');
const debug = require('debug')('chums:lib:b2b:contact-permissions');

const defaultPermissions = {Permissions: {}};
/**
 *
 * @param Company
 * @param ARDivisionNo
 * @param CustomerNo
 * @param ContactCode
 * @param Permissions
 * @return Promise
 */
async function saveUserPrivilege({Company, ARDivisionNo, CustomerNo, ContactCode, Permissions}) {
    try {
        const query = `INSERT INTO b2b.contacts (Company, ARDivisionNo, CustomerNo, ContactCode, Permissions,
                                                 PasswordHash, PasswordResetKey)
                       VALUES (:Company, :ARDivisionNo, :CustomerNo, :ContactCode, :Permissions, '', '')
                       ON DUPLICATE KEY UPDATE Permissions = :Permissions`;
        const data = {Company, ARDivisionNo, CustomerNo, ContactCode, Permissions: JSON.stringify(Permissions)};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("setUserPrivilege()", err.message);
        return Promise.reject(err);
    }
}

async function loadUserPrivilege({Company, ARDivisionNo, CustomerNo, ContactCode}) {
    try {
        const query = `SELECT Company, ARDivisionNo, CustomerNo, ContactCode, Permissions
                   FROM b2b.contacts
                   WHERE Company = :Company
                     AND ARDivisionNo = :ARDivisionNo
                     AND CustomerNo = :CustomerNo
                     AND ContactCode = :ContactCode`;
        const data = {Company, ARDivisionNo, CustomerNo, ContactCode};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.Permissions = JSON.parse(row.Permissions);
        });
        return rows;
    } catch(err) {
        debug("getUserPrivilege()", err.message);
        return Promise.reject(err);
    }
}

async function postPermissions(req, res, next) {
    try {
        let params = req.params;
        const [permissions = {...defaultPermissions}] = await loadUserPrivilege(params);
        params.Permissions = {...permissions, ...req.body};
        await saveUserPrivilege(params);
        const [result = {...defaultPermissions}] = await loadUserPrivilege(params);
        res.json({result})
    } catch(err) {
        debug("post()", err.message);
        return Promise.reject(err);
    }
}

async function getPermissions(req, res) {
    try {
        let params = req.params;
        const [result = {...defaultPermissions}] = await loadUserPrivilege(params);
        res.json({result});
    } catch(err) {
        debug("getPermissions()", err.message);
        return Promise.reject(err);
    }
}

exports.post = postPermissions;
exports.get = getPermissions;
