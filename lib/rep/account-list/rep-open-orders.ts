import Debug from "debug";
import {mysql2Pool, type ValidatedUser} from 'chums-local-modules';
import type {RepOpenOrder} from "./account-list-types.js";
import type {RowDataPacket} from "mysql2";
import type {Request, Response} from "express";

const debug = Debug('chums:lib:rep:account-list');

type RepOpenOrderRow = RepOpenOrder & RowDataPacket;

export interface LoadRecentOrdersProps {
    userId: number;
    salespersonNo?: string;
}

export async function loadOpenOrders({userId, salespersonNo}: LoadRecentOrdersProps): Promise<RepOpenOrder[]> {
    try {
        const sql = `SELECT h.SalesOrderNo,
                            h.SalespersonDivisionNo,
                            h.SalespersonNo,
                            h.OrderDate,
                            h.OrderType,
                            h.OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.ShipToCode,
                            h.BillToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToCountryCode,
                            h.OrderTotal,
                            h.LastInvoiceNo,
                            h.ShipExpireDate,
                            h.CancelReasonCode,
                            c.CancelReasonCodeDesc,
                            h.imprinted                  AS Imprinted,
                            IF(ISNULL(b2b.id), 'N', 'Y') AS B2BOrder
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                           FROM users.user_AR_Customer
                           WHERE userid = :userId
                             AND (IFNULL(:salespersonNo, '') = '' OR salespersonNo = :salespersonNo)) ac
                              INNER JOIN c2.SO_SalesOrderHeader h
                                         ON h.Company = ac.Company AND h.ARDivisionNo = ac.ARDivisionNo AND
                                            h.CustomerNo = ac.CustomerNo
                              LEFT JOIN c2.so_cancelreasoncode c
                                        ON c.Company = h.Company AND c.CancelReasonCode = h.CancelReasonCode
                              LEFT JOIN b2b.cart_header b2b
                                        ON b2b.salesOrderNo = h.SalesOrderNo
                     WHERE h.Company = 'chums'
                       AND h.ShipToCode IS NULL
                       AND h.OrderType NOT IN ('M')

                     UNION

                     SELECT h.SalesOrderNo,
                            h.SalespersonDivisionNo,
                            h.SalespersonNo,
                            h.OrderDate,
                            h.OrderType,
                            h.OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.ShipToCode,
                            h.BillToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToCountryCode,
                            h.OrderTotal,
                            h.LastInvoiceNo,
                            h.ShipExpireDate,
                            h.CancelReasonCode,
                            c.CancelReasonCodeDesc,
                            h.imprinted                  AS Imprinted,
                            IF(ISNULL(b2b.id), 'N', 'Y') AS B2BOrder
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                           FROM users.user_SO_ShipToAddress
                           WHERE userid = :userId
                             AND (IFNULL(:salespersonNo, '') = '' OR salespersonNo = :salespersonNo)) ac
                              INNER JOIN c2.SO_SalesOrderHeader h
                                         ON h.Company = ac.Company AND h.ARDivisionNo = ac.ARDivisionNo AND
                                            h.CustomerNo = ac.CustomerNo AND h.ShipToCode = ac.ShipToCode
                              LEFT JOIN c2.so_cancelreasoncode c
                                        ON c.Company = h.Company AND c.CancelReasonCode = h.CancelReasonCode
                              LEFT JOIN b2b.cart_header b2b
                                        ON b2b.salesOrderNo = h.SalesOrderNo
                     WHERE h.Company = 'chums'
                       AND h.OrderType NOT IN ('M')

                     ORDER BY OrderDate, SalesOrderNo`;
        const args = {userId, salespersonNo};
        const [rows] = await mysql2Pool.query<RepOpenOrderRow[]>(sql, args);
        return rows;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadRecentOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadRecentOrders()", err);
        return Promise.reject(new Error('Error in loadRecentOrders()'));
    }
}

export async function getRepOpenOrders(req: Request, res: Response<unknown, ValidatedUser>): Promise<void> {
    try {
        const openOrders = await loadOpenOrders({
            userId: res.locals.profile!.user.id,
            salespersonNo: req.params.SalespersonNo as string ?? req.query.salespersonNo as string
        });
        res.json(openOrders);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getRepOpenOrders()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getRepOpenOrders'});
    }
}
