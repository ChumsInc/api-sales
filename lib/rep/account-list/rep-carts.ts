import {mysql2Pool, type ValidatedUser} from "chums-local-modules";
import Debug from 'debug';
import type {RepOpenCart} from "./account-list-types.js";
import type {RowDataPacket} from "mysql2";
import type {Request, Response} from "express";

const debug = Debug('chums:lib:rep:account-list:rep-carts');

type RepOpenCartRow = RepOpenCart & RowDataPacket;

export interface LoadRepCartsProps {
    userId: number;
    salespersonNo?: string;
}

export async function loadRepCarts({userId, salespersonNo}: LoadRepCartsProps): Promise<RepOpenCart[]> {
    try {
        const sql = `SELECT ch.id,
                            ch.salesOrderNo,
                            ch.dateCreated,
                            ch.dateUpdated,
                            ch.arDivisionNo,
                            ch.customerNo,
                            c.CustomerName AS customerName,
                            NULL           AS shipToCode,
                            NULL           AS shipToName,
                            ch.shipExpireDate as expireDate,
                            ch.subTotalAmt,
                            ch.comment,
                            u.email,
                            u.name,                        
                            u.accountType
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                           FROM users.user_AR_Customer
                           WHERE userid = :userId
                             AND (IFNULL(:salespersonNo, '') = '' OR salespersonNo = :salespersonNo)) ac
                              INNER JOIN b2b.cart_header ch
                                         ON ch.arDivisionNo = ac.ARDivisionNo AND ch.customerNo = ac.CustomerNo
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = ac.Company AND c.ARDivisionNo = ac.ARDivisionNo AND
                                            c.CustomerNo = ac.CustomerNo
                              LEFT JOIN c2.SO_SalesOrderHeader oh
                                        ON oh.salesOrderNo = ch.salesOrderNo AND oh.company = 'chums'
                              LEFT JOIN users.users u ON u.id = ch.createdByUserId
                     WHERE c.Company = 'chums'
                       AND ch.shipToCode IS NULL
                       AND ch.orderStatus not in ('X', 'Z')
                       AND (oh.SalesOrderNo IS NOT NULL OR ch.shipExpireDate > DATE(NOW()))
                       AND (IFNULL(oh.OrderType, '') = '' OR oh.OrderType <> 'S')

                     UNION

                     SELECT ch.id,
                            ch.salesOrderNo,
                            ch.dateCreated,
                            ch.dateUpdated,
                            ch.arDivisionNo,
                            ch.customerNo,
                            c.CustomerName AS customerName,
                            ch.shipToCode,
                            s.ShipToName   AS shipToName,
                            ch.shipExpireDate,
                            ch.subTotalAmt,
                            ch.comment,
                            u.email,
                            u.name,
                            u.accountType
                     FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                           FROM users.user_SO_ShipToAddress
                           WHERE userid = :userId
                             AND (IFNULL(:salespersonNo, '') = '' OR salespersonNo = :salespersonNo)) ac
                              INNER JOIN b2b.cart_header ch
                                         ON ch.arDivisionNo = ac.ARDivisionNo AND ch.customerNo = ac.CustomerNo AND
                                            ch.shipToCode = ac.ShipToCode
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = ac.Company AND c.ARDivisionNo = ac.ARDivisionNo AND
                                            c.CustomerNo = ac.CustomerNo
                              INNER JOIN c2.SO_ShipToAddress s
                                         ON s.ARDivisionNo = ac.arDivisionNo AND s.CustomerNo = ac.customerNo AND
                                            s.shipToCode = ac.shipToCode AND s.company = ac.Company
                              LEFT JOIN c2.SO_SalesOrderHeader oh
                                        ON oh.salesOrderNo = ch.salesOrderNo AND oh.company = 'chums'
                              LEFT JOIN users.users u ON u.id = ch.createdByUserId
                     WHERE c.Company = 'chums'
                       AND (oh.SalesOrderNo IS NOT NULL OR ch.shipExpireDate > DATE(NOW()))
                       AND (IFNULL(oh.OrderType, '') = '' OR oh.OrderType <> 'S')
                       AND ch.orderStatus not in ('X', 'Z')
        `;
        const [rows] = await mysql2Pool.query<RepOpenCartRow[]>(sql, {userId, salespersonNo});
        return rows;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadRepCarts()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepCarts()", err);
        return Promise.reject(new Error('Error in loadRepCarts()'));
    }
}

export async function getRepCarts(req: Request, res: Response<unknown, ValidatedUser>): Promise<void> {
    try {
        const carts = await loadRepCarts({
            userId: res.locals.auth.profile!.user.id,
            salespersonNo: req.query.salespersonNo as string,
        })
        res.json(carts);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in '});
    }
}
