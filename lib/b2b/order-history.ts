import Debug from 'debug';
import {RowDataPacket} from "mysql2";
import {mysql2Pool} from "chums-local-modules";
import {Request, Response} from 'express'
import dayjs from "dayjs";
import {B2BHistoryOrder} from "./types.js";

const debug = Debug('chums:lib:b2b:order-history');

export interface B2BOrderRow extends RowDataPacket, Omit<B2BHistoryOrder, 'users'|'userActions'|'actions'> {
    users: string|null;
    userActions: string|null;
    actions: string|null;
}

export interface LoadOrderHistoryParams {
    minDate?: string|null;
    maxDate?: string|null;
    userId?: number|string|null;
    arDivisionNo?: string|null;
    customerNo?: string|null;
}

async function loadOrderHistory(params: LoadOrderHistoryParams): Promise<B2BHistoryOrder[]> {
    try {
        const sql = `SELECT sohh.SalesOrderNo,
                            sohh.OrderStatus,
                            sohh.ARDivisionNo,
                            sohh.CustomerNo,
                            sohh.ShipToCode,
                            sohh.BillToName,
                            sohh.ShipToName,
                            sohh.OrderDate,
                            sohh.PromotedDate,
                            sohh.ShipExpireDate,
                            sohh.LastInvoiceDate,
                            (sohh.TaxableAmt + sohh.NonTaxableAmt - sohh.DiscountAmt) AS OrderTotal,
                            b2bh.users,
                            b2bh.userActions,
                            b2bh.actions
                     FROM c2.SO_SalesOrderHistoryHeader sohh
                              INNER JOIN (SELECT bh.dbCompany     AS Company,
                                                 bh.SalesOrderNo,
                                                 JSON_ARRAYAGG(DISTINCT
                                                               JSON_OBJECT(
                                                                       'userId', UserID,
                                                                       'action', JSON_VALUE(action, '$.action')
                                                               ) ORDER BY bh.original_timestamp
                                                 )                AS userActions,
                                                 JSON_ARRAYAGG(DISTINCT
                                                               JSON_OBJECT(
                                                                       'userId', u.id,
                                                                       'email', u.email,
                                                                       'name', u.name,
                                                                       'userType', u.accountType
                                                               )) AS users,
                                                 JSON_ARRAYAGG(
                                                         JSON_QUERY(action, '$.post') ORDER BY bh.original_timestamp
                                                 )                AS actions
                                          FROM b2b.SalesOrderHistory bh
                                                   INNER JOIN users.users u ON u.id = bh.UserID
                                          WHERE bh.dbCompany = 'chums'
                                            AND JSON_VALUE(action, '$.action') NOT IN ('cleanup', 'print')
                                            AND (IFNULL(:userId, 0) = 0 OR u.id = :userId)
                                          GROUP BY dbCompany, SalesOrderNo) b2bh
                                         ON b2bh.Company = sohh.Company AND b2bh.SalesOrderNo = sohh.SalesOrderNo
                     WHERE sohh.Company = 'chums'
                       AND sohh.OrderStatus NOT IN ('X', 'Z')
                       AND (IFNULL(:arDivisionNo, '') = '' OR sohh.ARDivisionNo = :arDivisionNo)
                       AND (IFNULL(:customerNo, '') = '' OR sohh.CustomerNo = :customerNo)
                       AND (
                         ((IFNULL(:minDate, '') = '' OR sohh.OrderDate >= :minDate) AND
                          (IFNULL(:maxDate, '') = '' OR sohh.OrderDate <= :maxDate))
                             OR
                         ((IFNULL(:minDate, '') = '' OR sohh.PromotedDate >= :minDate) AND
                          (IFNULL(:maxDate, '') = '' OR sohh.PromotedDate <= :maxDate))
                         )`;
        const [rows] = await mysql2Pool.query<B2BOrderRow[]>(sql, params);
        return rows.map(row => {
            return {
                ...row,
                users: JSON.parse(row.users ?? '[]'),
                userActions: JSON.parse(row.userActions ?? '[]'),
                actions: JSON.parse(row.actions ?? '[]'),
            }
        })
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.debug("loadOrderHistory()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadOrderHistory()", err);
        return Promise.reject(new Error('Error in loadOrderHistory()'));
    }
}

export const getOrderHistory = async (req:Request, res:Response) => {
    try {
        const minDate:string|null = req.query.minDate as string;
        const maxDate:string|null = req.query.maxDate as string;
        const userId:string|null = req.query.userId as string ?? null;
        const arDivisionNo:string|null = req.query.arDivisionNo as string ?? null;
        const customerNo:string|null = req.query.customerNo as string ?? null;

        const params:LoadOrderHistoryParams = {
            minDate: dayjs(minDate).isValid() ? dayjs(minDate).format('YYYY-MM-DD') : null,
            maxDate: dayjs(maxDate).isValid() ? dayjs(maxDate).format('YYYY-MM-DD') : null,
            userId,
            arDivisionNo,
            customerNo,
        }
        const orders = await loadOrderHistory(params);
        res.json({params, orders});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getOrderHistory()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getOrderHistory'});
    }
}
