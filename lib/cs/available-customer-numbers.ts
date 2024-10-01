import Debug from 'debug';
import {RowDataPacket} from "mysql2";
import {mysql2Pool} from "chums-local-modules";
import {Request, Response} from 'express'

const debug = Debug("chums:lib:cs:available-customer-numbers");

interface ExistingCustomer {
    CustomerNo: string;
}
type ExistingCustomerRow = RowDataPacket & ExistingCustomer;

export async function loadExistingCustomerNumbers(prefix: string): Promise<string[]> {
    try {
        if (prefix.endsWith('%')) {
            prefix = prefix.slice(0, prefix.length - 1);
        }
        const sql = `SELECT DISTINCT CustomerNo FROM c2.ar_customer WHERE CustomerNo LIKE :prefix
                     UNION
                     SELECT DISTINCT CustomerNo FROM c2.ar_invoicehistoryheader WHERE CustomerNo LIKE :prefix
                     UNION
                     SELECT DISTINCT CustomerNo FROM c2.SO_SalesOrderHistoryHeader WHERE CustomerNo LIKE :prefix
                     `
        const [rows] = await mysql2Pool.query<ExistingCustomerRow[]>(sql, {prefix: `${prefix}%`});
        return rows.map(row => row.CustomerNo);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadAvailableCustomerNumbers()", err.message);
            return Promise.reject(err);
        }
        debug("loadAvailableCustomerNumbers()", err);
        return Promise.reject(new Error('Error in loadAvailableCustomerNumbers()'));
    }
}

export async function loadAvailableCustomerNumbers(prefix: string, limit: number = 10): Promise<string[]> {
    try {
        const available = [];
        let done = false;
        const existing = await loadExistingCustomerNumbers(prefix);
        for (let i = 1; i <= 9999 && available.length < limit; i += 1) {
            let key = `${prefix}${String(i).padStart(4, '0')}`;
            if (!existing.includes(key)) {
                available.push(key);
            }
        }
        return available;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadAvailableCustomerNumbers()", err.message);
            return Promise.reject(err);
        }
        debug("loadAvailableCustomerNumbers()", err);
        return Promise.reject(new Error('Error in loadAvailableCustomerNumbers()'));
    }
}

export async function getAvailableCustomerNumbers(req:Request, res:Response) {
    try {
        const prefix = req.query.prefix as string ?? '';
        if (!prefix.length || prefix.length < 2) {
            res.json({error: 'At least two letters are required for the customer prefix'});
            return;
        }
        let limit = +(req.query.limit as string);
        if (!limit || isNaN(limit)) {
            limit = 10;
        }
        const available = await loadAvailableCustomerNumbers(prefix, limit);
        res.json({result: available});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getAvailableCustomerNumbers()", err.message);
            return res.json({error: err.message, name: err.name});    
        }
        res.json({error: 'unknown error in getAvailableCustomerNumbers'});
    }
}
