// import Debug from 'debug';
// import {mysql2Pool} from "chums-local-modules";
// import {Request, Response} from "express";

import Debug from 'debug'
import {mysql2Pool} from "chums-local-modules";

const debug = Debug('chums:lib:salesorder:account-orders');

/**
 *
 * @param {number} user_id
 * @param {string} company
 * @param {string} ARDivisionNo
 * @param {string} CustomerNo
 * @return {Promise<*>}
 */
async function loadAccountOpenOrders({user_id, company, ARDivisionNo, CustomerNo}) {
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
                                 WHERE Company = :Company
                                   AND ARDivisionNo = :ARDivisionNo
                                   AND CustomerNo = :CustomerNo
                                   AND userid = :user_id
                                 UNION
                                 SELECT Company, ARDivisionNo, CustomerNo, ShipToCode
                                 FROM users.user_SO_ShipToAddress
                                 WHERE Company = :Company
                                   AND ARDivisionNo = :ARDivisionNo
                                   AND CustomerNo = :CustomerNo
                                   AND userid = :user_id) accounts
                                ON accounts.Company = h.Company
                                    AND accounts.ARDivisionNo = h.ARDivisionNo
                                    AND accounts.CustomerNo = h.CustomerNo
                                    AND accounts.ShipToCode = IFNULL(h.ShipToCode, '')
            WHERE h.OrderType NOT IN ('Q', 'M')
            ORDER BY h.SalesOrderNo`;
        const data = {user_id, Company: company, ARDivisionNo, CustomerNo};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.DiscountAmt = Number(row.DiscountAmt);
            row.FreightAmt = Number(row.FreightAmt);
            row.NonTaxableAmt = Number(row.NonTaxableAmt);
            row.SalesTaxAmt = Number(row.SalesTaxAmt);
            row.TaxableAmt = Number(row.TaxableAmt);
        })
        return rows;
    } catch (err) {
        debug("loadAccountOpenOrders()", err.message);
        return err;
    }
}


/**
 *
 * @param {LoadOrdersParams} params
 * @return {Promise<*>}
 */
async function loadAccountClosedOrders(params) {
    try {
        let {limit, offset} = params;
        const {user_id, company, ARDivisionNo, CustomerNo} = params;
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
                                          WHERE Company = :Company
                                            AND ARDivisionNo = :ARDivisionNo
                                            AND CustomerNo = :CustomerNo
                                            AND userid = :user_id
                                          UNION
                                          SELECT Company, ARDivisionNo, CustomerNo, ShipToCode
                                          FROM users.user_SO_ShipToAddress
                                          WHERE Company = :Company
                                            AND ARDivisionNo = :ARDivisionNo
                                            AND CustomerNo = :CustomerNo
                                            AND userid = :user_id
                                          ORDER BY Company, ARDivisionNo, CustomerNo, ShipToCode) accounts
                                         USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
                     WHERE h.OrderStatus = 'C'
                     ORDER BY h.OrderDate DESC, h.SalesOrderNo
                     LIMIT :limit OFFSET :offset`;
        const sqlArgs = {user_id, Company: company, ARDivisionNo, CustomerNo, limit, offset};
        const [rows] = await mysql2Pool.query(sql, sqlArgs);
        return rows;
    } catch (err) {
        debug("loadAccountClosedOrders()", err.message);
        return err;
    }
}

/**
 *
 * @param {Request} req
 * @param {Response} res
 * @return {Promise<void>}
 */
export async function getAccountOpenOrders(req, res) {
    try {
        /**
         *
         * @type {LoadOrdersParams}
         */
        const params = {
            user_id: res.locals.profile.user.id,
            company: req.params.company,
            ARDivisionNo: req.params.ARDivisionNo,
            CustomerNo: req.params.CustomerNo
        };
        const result = await loadAccountOpenOrders(params);
        res.json({result});
    } catch (err) {
        debug("getAccountOpenOrders()", err.message);
        res.json({error: err.message});
    }
}


/**
 *
 * @param {Request} req
 * @param {Response} res
 * @return {Promise<void>}
 */
export async function getAccountClosedOrders(req, res) {
    try {
        /**
         *
         * @type {LoadOrdersParams}
         */
        const params = {
            user_id: res.locals.profile.user.id,
            Company: req.params.Company,
            ARDivisionNo: req.params.ARDivisionNo,
            CustomerNo: req.params.CustomerNo,
            offset: req.query.offset || 0,
            limit: req.query.limit || 1000
        };
        const result = await loadAccountClosedOrders(params);
        res.json({result});
    } catch (err) {
        debug("getAccountClosedOrders()", err.message);
        res.json({error: err.message});
    }
}
