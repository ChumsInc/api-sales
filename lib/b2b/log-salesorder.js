/**
 * Created by steve on 3/3/2017.
 */

const {mysql2Pool} = require('chums-local-modules');
const debug = require('debug')('chums:lib:b2b:log-salesorder');

/**
 *
 * @param {Object} params
 * @param {String} params.Company
 * @param {String} params.SalesOrderNo
 * @param {String} params.OrderStatus
 * @param {String} [params.Notes]
 * @param {number} params.UserID
 * @param {String} params.action
 */
async function logSalesOrder(params) {
    try {
        const query = `INSERT INTO b2b.SalesOrderLog (Company, dbCompany, SalesOrderNo, OrderStatus, Notes, UserID, action)
    VALUES (:Company, b2b.dbCompany(:Company), :SalesOrderNo, :OrderStatus, :Notes, :UserID, :action)
    ON DUPLICATE KEY UPDATE OrderStatus = :OrderStatus, Notes = :Noets, UserID = :UserID, action = :action`;
        const data = {
            Company: params.Company,
            SalesOrderNo: params.SalesOrderNo,
            OrderStatus: params.OrderStatus,
            Notes: params.Notes || null,
            UserID: params.UserID,
            action: JSON.stringify(params.action)
        };
        await mysql2Pool.query(query, data);
        return {success: true};
    } catch(err) {
        debug("logSalesOrder()", err.message);
        return Promise.reject(err);
    }
}

exports.postAction = async (req, res) => {
    try {
        req.body.action = req.params.action;
        let params = {
            Company: req.params.Company,
            SalesOrderNo: req.params.SalesOrderNo,
            UserID: res.locals.profile.user.id,
            action: req.body,
        };
        switch (req.params.action.toLowerCase()) {
        case 'create':
            params.OrderStatus = 'Q';
            break;
        case 'promote':
            params.OrderStatus = 'N';
            break;
        case 'print':
            params.OrderStatus = 'P';
            break;
        }
        const result = await logSalesOrder(params);
        res.json({result});
    } catch(err) {
        debug("postAction()", err.message);
        res.json({error: err.message});
    }
};
