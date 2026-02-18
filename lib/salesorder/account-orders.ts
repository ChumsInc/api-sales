// import Debug from 'debug';
// import {mysql2Pool} from "chums-local-modules";
// import {Request, Response} from "express";

import Debug from 'debug'
import {mysql2Pool, ValidatedUser} from "chums-local-modules";
import {AccountClosedOrder, AccountOpenOrder, LoadOrdersParams} from "./types.js";
import {RowDataPacket} from "mysql2";
import {Request, Response} from "express";

const debug = Debug('chums:lib:salesorder:account-orders');

type AccountOpenOrderRow = RowDataPacket & AccountOpenOrder;

async function loadAccountOpenOrders({user_id, ARDivisionNo, CustomerNo}:LoadOrdersParams):Promise<AccountOpenOrder[]> {
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
        const data = {user_id, ARDivisionNo, CustomerNo};
        const [rows] = await mysql2Pool.query<AccountOpenOrderRow[]>(query, data);
        return rows;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadAccountOpenOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadAccountOpenOrders()", err);
        return Promise.reject(new Error('Error in loadAccountOpenOrders()'));
    }
}

type AccountClosedOrderRow = RowDataPacket & AccountClosedOrder;

async function loadAccountClosedOrders(params:LoadOrdersParams):Promise<AccountClosedOrder[]> {
    try {
        let {limit, offset} = params;
        const {user_id, ARDivisionNo, CustomerNo} = params;
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
        const sqlArgs = {user_id, ARDivisionNo, CustomerNo, limit, offset};
        const [rows] = await mysql2Pool.query<AccountClosedOrderRow[]>(sql, sqlArgs);
        return rows;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadAccountClosedOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadAccountClosedOrders()", err);
        return Promise.reject(new Error('Error in loadAccountClosedOrders()'));
    }
}

export async function getAccountOpenOrders(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        /**
         *
         * @type {LoadOrdersParams}
         */
        const params:LoadOrdersParams = {
            user_id: res.locals.profile.user.id,
            ARDivisionNo: req.params.ARDivisionNo as string,
            CustomerNo: req.params.CustomerNo as string
        };
        const result = await loadAccountOpenOrders(params);
        res.json({result});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getAccountOpenOrders()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getAccountOpenOrders'});
    }
}


export async function getAccountClosedOrders(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        const params:LoadOrdersParams = {
            user_id: res.locals.profile.user.id,
            ARDivisionNo: req.params.ARDivisionNo as string,
            CustomerNo: req.params.CustomerNo as string,
            offset: req.query.offset as string ?? 0,
            limit: req.query.limit as string ?? 1000
        };
        const result = await loadAccountClosedOrders(params);
        res.json({result});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getAccountClosedOrders()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getAccountClosedOrders'});
    }
}
