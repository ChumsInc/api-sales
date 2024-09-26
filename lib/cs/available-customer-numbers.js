import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug("chums:lib:cs:available-customer-numbers");
export async function loadExistingCustomerNumbers(prefix) {
    try {
        if (prefix.endsWith('%')) {
            prefix = prefix.slice(0, prefix.length - 1);
        }
        const sql = `SELECT DISTINCT CustomerNo FROM c2.ar_customer WHERE CustomerNo LIKE :prefix
                     UNION
                     SELECT DISTINCT CustomerNo FROM c2.ar_invoicehistoryheader WHERE CustomerNo LIKE :prefix`;
        const [rows] = await mysql2Pool.query(sql, { prefix: `${prefix}%` });
        return rows.map(row => row.CustomerNo);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadAvailableCustomerNumbers()", err.message);
            return Promise.reject(err);
        }
        debug("loadAvailableCustomerNumbers()", err);
        return Promise.reject(new Error('Error in loadAvailableCustomerNumbers()'));
    }
}
export async function loadAvailableCustomerNumbers(prefix, limit = 10) {
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
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadAvailableCustomerNumbers()", err.message);
            return Promise.reject(err);
        }
        debug("loadAvailableCustomerNumbers()", err);
        return Promise.reject(new Error('Error in loadAvailableCustomerNumbers()'));
    }
}
export async function getAvailableCustomerNumbers(req, res) {
    try {
        const prefix = req.query.prefix ?? '';
        if (!prefix.length || prefix.length < 2) {
            res.json({ error: 'At least two letters are required for the customer prefix' });
            return;
        }
        let limit = +req.query.limit;
        if (!limit || isNaN(limit)) {
            limit = 10;
        }
        const available = await loadAvailableCustomerNumbers(prefix, limit);
        res.json({ result: available });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getAvailableCustomerNumbers()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getAvailableCustomerNumbers' });
    }
}
