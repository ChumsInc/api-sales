import Debug from "debug";
import {mysql2Pool} from "chums-local-modules";
import {RowDataPacket} from "mysql2";
import {Request, Response} from 'express'
import dayjs from "dayjs";
import {Decimal} from "decimal.js";

const debug = Debug('chums:lib:account');

export interface RenamedCustomer {
    ARDivisionNo: string;
    CustomerNo: string;
    CustomerStatus: string;
    previousCustomerName: string;
    updatedCustomerName: string;
    dateUpdated: string;
    userName: string;
}

type RenamedCustomerRow = RenamedCustomer & RowDataPacket;

export async function loadCustomerRenameHistory(since?: number | string | null): Promise<RenamedCustomer[]> {
    since = new Decimal(since ?? 30).times(-1).toNumber();
    try {
        const sql = `SELECT a.ARDivisionNo,
                            a.CustomerNo,
                            c.CustomerStatus,
                            IFNULL(FieldValueOriginal, '')          AS previousCustomerName,
                            IFNULL(NewFieldValue, '')               AS updatedCustomerName,
                            a.Date                                  AS dateUpdated,
                            CONCAT_WS(' ', u.FirstName, u.LastName) AS userName
                     FROM c2.AR_Audit a
                              INNER JOIN c2.ar_customer c
                                         ON c.Company = 'chums' AND
                                            c.ARDivisionNo = a.ARDivisionNo AND
                                            c.CustomerNo = a.CustomerNo
                              LEFT JOIN c2.SY_User u ON u.UserKey = a.UserKey
                     WHERE Date > DATE_ADD(NOW(), INTERVAL :since DAY)
                       AND FieldName = 'Customer Name'
                       AND LOWER(ifnull(FieldValueOriginal, '')) <> LOWER(ifnull(NewFieldValue, ''))
                       AND a.Date > c.DateCreated
                       AND c.CustomerStatus <> 'I'
                     ORDER BY a.ARDivisionNo, a.CustomerNo, a.Date, a.SequenceNo`
        const [rows] = await mysql2Pool.query<RenamedCustomerRow[]>(sql, {since});
        return rows;
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadCustomerRenameHistory()", err.message);
            return Promise.reject(err);
        }
        debug("loadCustomerRenameHistory()", err);
        return Promise.reject(new Error('Error in loadCustomerRenameHistory()'));
    }
}

export async function renderCustomerRenameHistory(req: Request, res: Response): Promise<void> {
    try {
        const since = req.query.since as string;
        const rows = await loadCustomerRenameHistory(since ?? null);
        if (!rows.length) {
            res.status(304).json({changes: []});
            return;
        }
        const args = {
            since,
            rows: rows.map(row => ({...row, dateUpdated: dayjs(row.dateUpdated).format('MM/DD/YYYY')})),
        }
        res.render('audits/customer/customer-rename.pug', args);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("renderCustomerRenameHistory()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in renderCustomerRenameHistory'});
    }
}

export async function getCustomerRenameHistory(req: Request, res: Response): Promise<void> {
    try {
        const since = req.query.since as string;
        const rows = await loadCustomerRenameHistory(since ?? null);
        res.json({changes: rows});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("renderCustomerRenameHistory()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in renderCustomerRenameHistory'});
    }
}
