/**
 * Created by steve on 3/3/2017.
 */

import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
const debug = Debug('chums:lib:b2b:log-salesorder');

/**
 *
 * @param {Object} params
 * @param {String} params.salesOrderNo
 * @param {String} params.orderStatus
 * @param {String} [params.notes]
 * @param {number} params.userID
 * @param {String|object} params.action
 */
async function logSalesOrder(params) {
    try {
        const query = `INSERT INTO b2b.SalesOrderLog (Company, dbCompany, SalesOrderNo, OrderStatus, Notes, UserID, action)
    VALUES ('CHI', 'chums', :SalesOrderNo, :OrderStatus, :Notes, :UserID, :action)
    ON DUPLICATE KEY UPDATE OrderStatus = :OrderStatus, Notes = :Notes, UserID = :UserID, action = :action`;
        const data = {
            SalesOrderNo: params.salesOrderNo,
            OrderStatus: params.orderStatus,
            Notes: params.notes ?? null,
            UserID: params.userID,
            action: JSON.stringify(params.action)
        };
        await mysql2Pool.query(query, data);
        return {success: true};
    } catch(err) {
        debug("logSalesOrder()", err.message);
        return Promise.reject(err);
    }
}

export const postLogSalesOrderAction = async (req, res) => {
    try {
        req.body.action = req.params.action;
        let params = {
            salesOrderNo: req.params.salesOrderNo ?? req.params.SalesOrderNo,
            orderStatus: '',
            notes: req.query.notes ?? null,
            userID: res.locals.profile.user.id,
            action: req.body,
        };
        switch (req.params.action.toLowerCase()) {
        case 'create':
            params.orderStatus = 'Q';
            break;
        case 'promote':
            params.orderStatus = 'N';
            break;
        case 'print':
            params.orderStatus = 'P';
            break;
        }
        const result = await logSalesOrder(params);
        res.json({result});
    } catch(err) {
        debug("postAction()", err.message);
        res.json({error: err.message});
    }
};
