// import Debug from 'debug';
// import {mysql2Pool} from "chums-local-modules";
// import {Request, Response} from "express";
import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:salesorder:account-orders');
async function loadAccountOpenOrders({ user_id, ARDivisionNo, CustomerNo }) {
    try {
        const query = `
            SELECT h.Company,
                   h.SalesOrderNo,
                   h.ARDivisionNo,
                   h.ShipExpireDate,
                   h.CustomerPONo,
                   h.CustomerNo,
                   h.BillToName,
                   h.OrderDate,
                   h.OrderType,
                   h.OrderStatus,
                   h.ShipToCode,
                   h.ShipToName,
                   h.ShipToCity,
                   h.ShipToState,
                   h.TaxableAmt,
                   h.NonTaxableAmt,
                   h.DiscountAmt,
                   h.SalesTaxAmt,
                   h.FreightAmt,
                   h.LastInvoiceNo,
                   h.Imprinted,
                   h.UDF_CANCEL_DATE,
                   h.CancelReasonCode
            FROM c2.SO_SalesOrderHeader h
                     INNER JOIN (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, '' AS ShipToCode
                                 FROM users.user_AR_Customer
                                 WHERE Company = 'chums'
                                   AND ARDivisionNo = :ARDivisionNo
                                   AND CustomerNo = :CustomerNo
                                   AND userid = :user_id
                                 UNION
                                 SELECT Company, ARDivisionNo, CustomerNo, ShipToCode
                                 FROM users.user_SO_ShipToAddress
                                 WHERE Company = 'chums'
                                   AND ARDivisionNo = :ARDivisionNo
                                   AND CustomerNo = :CustomerNo
                                   AND userid = :user_id) accounts
                                ON accounts.Company = h.Company
                                    AND accounts.ARDivisionNo = h.ARDivisionNo
                                    AND accounts.CustomerNo = h.CustomerNo
                                    AND accounts.ShipToCode = IFNULL(h.ShipToCode, '')
            WHERE h.OrderType NOT IN ('Q', 'M')
            ORDER BY h.SalesOrderNo`;
        const data = { user_id, ARDivisionNo, CustomerNo };
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadAccountOpenOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadAccountOpenOrders()", err);
        return Promise.reject(new Error('Error in loadAccountOpenOrders()'));
    }
}
async function loadAccountClosedOrders(params) {
    try {
        let { limit, offset } = params;
        const { user_id, ARDivisionNo, CustomerNo } = params;
        limit = Number(limit || 1000) || 1000;
        offset = Number(offset || 0) || 0;
        const sql = `SELECT h.Company,
                            h.SalesOrderNo,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.CustomerPONo,
                            h.BillToName,
                            h.OrderDate,
                            h.OrderStatus,
                            h.ShipToCode,
                            h.ShipToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.TaxableAmt,
                            h.NonTaxableAmt,
                            h.DiscountAmt,
                            h.SalesTaxAmt,
                            h.FreightAmt,
                            h.LastInvoiceNo,
                            h.LastInvoiceDate
                     FROM c2.SO_SalesOrderHistoryHeader h
                              INNER JOIN (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, '' AS ShipToCode
                                          FROM users.user_AR_Customer
                                          WHERE Company = 'chums'
                                            AND ARDivisionNo = :ARDivisionNo
                                            AND CustomerNo = :CustomerNo
                                            AND userid = :user_id
                                          UNION
                                          SELECT Company, ARDivisionNo, CustomerNo, ShipToCode
                                          FROM users.user_SO_ShipToAddress
                                          WHERE Company = 'chums'
                                            AND ARDivisionNo = :ARDivisionNo
                                            AND CustomerNo = :CustomerNo
                                            AND userid = :user_id
                                          ORDER BY Company, ARDivisionNo, CustomerNo, ShipToCode) accounts
                                         USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
                     WHERE h.OrderStatus = 'C'
                     ORDER BY h.OrderDate DESC, h.SalesOrderNo
                     LIMIT :limit OFFSET :offset`;
        const sqlArgs = { user_id, ARDivisionNo, CustomerNo, limit, offset };
        const [rows] = await mysql2Pool.query(sql, sqlArgs);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadAccountClosedOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadAccountClosedOrders()", err);
        return Promise.reject(new Error('Error in loadAccountClosedOrders()'));
    }
}
export async function getAccountOpenOrders(req, res) {
    try {
        /**
         *
         * @type {LoadOrdersParams}
         */
        const params = {
            user_id: res.locals.profile.user.id,
            ARDivisionNo: req.params.ARDivisionNo,
            CustomerNo: req.params.CustomerNo
        };
        const result = await loadAccountOpenOrders(params);
        res.json({ result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getAccountOpenOrders()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getAccountOpenOrders' });
    }
}
export async function getAccountClosedOrders(req, res) {
    try {
        const params = {
            user_id: res.locals.profile.user.id,
            ARDivisionNo: req.params.ARDivisionNo,
            CustomerNo: req.params.CustomerNo,
            offset: req.query.offset ?? 0,
            limit: req.query.limit ?? 1000
        };
        const result = await loadAccountClosedOrders(params);
        res.json({ result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getAccountClosedOrders()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getAccountClosedOrders' });
    }
}
