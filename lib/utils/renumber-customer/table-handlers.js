import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
import { logRenumberResult } from "./logger.js";
import { getCustomerKey, isFulfilledResponse, isRejectedResponse } from "./utils.js";
const debug = Debug('chums:lib:utils:renumber-customer:table-handlers');
const emptyResponse = {
    affectedRows: 0,
    remaining: 0,
};
const tables = [
    { table: 'c2.ar_alternateinvoice', handler: ARAlternativeInvoiceHandler },
    { table: 'c2.ar_customer_location', handler: deleteRemainingHandler },
    { table: 'c2.AR_CustomerContact', handler: deleteRemainingHandler },
    { table: 'c2.AR_CustomerCreditCard', handler: deleteRemainingHandler },
    { table: 'c2.AR_CustomerSalesHistory', handler: ARCustomerSalesHistory },
    { table: 'c2.AR_EDICustomer' },
    { table: 'c2.ar_invoicehistoryheader' },
    { table: 'c2.ar_salespersoncommission' },
    { table: 'c2.IM_ItemTransactionHistory' },
    { table: 'c2.SO_SalesOrderHistoryHeader' },
    { table: 'c2.IM_ItemCustomerHistoryByPeriod' },
    { table: 'c2.SO_ShipToAddress', handler: deleteRemainingHandler },
    { table: 'barcodes.bc_customer', handler: deleteRemainingHandler },
    { table: 'c2.ar_customer', handler: deleteRemainingHandler }
];
export async function execRenumberCustomer(userId, from, to, options) {
    try {
        const response = await Promise.allSettled(tables.map(tableDef => {
            if (tableDef.handler) {
                return tableDef.handler(userId, tableDef.table, from, to, options);
            }
            return genericTableHandler(userId, tableDef.table, from, to, options);
        }));
        return [
            ...response.filter(r => isFulfilledResponse(r)).map(r => r.value),
            ...response.filter(r => isRejectedResponse(r)).map(r => r.reason)
        ];
    }
    catch (err) {
        if (err instanceof Error) {
            debug("execRenumberCustomer()", err.message);
            return Promise.reject(err);
        }
        debug("execRenumberCustomer()", err);
        return Promise.reject(new Error('Error in execRenumberCustomer()'));
    }
}
async function checkExisting(table, from) {
    try {
        const { arDivisionNo, customerNo } = getCustomerKey(from);
        const sql = `SELECT COUNT(*) AS remaining
                     FROM ${table}
                     WHERE Company = 'chums'
                       AND ARDivisionNo = :arDivisionNo
                       AND CustomerNo = :customerNo`;
        const [rows] = await mysql2Pool.query(sql, { arDivisionNo, customerNo });
        return rows[0]?.remaining ?? 0;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("checkExisting()", err.message);
            return Promise.reject(err);
        }
        debug("checkExisting()", err);
        return Promise.reject(new Error('Error in checkExisting()'));
    }
}
async function updateCustomer(table, from, to) {
    try {
        const sql = `UPDATE IGNORE ${table}
                     SET ARDivisionNo = :newARDivisionNo,
                         CustomerNo   = :newCustomerNo
                     WHERE Company = 'chums'
                       AND ARDivisionNo = :arDivisionNo
                       AND CustomerNo = :customerNo`;
        const { arDivisionNo, customerNo } = getCustomerKey(from);
        const { arDivisionNo: newARDivisionNo, customerNo: newCustomerNo } = getCustomerKey(to);
        const [result] = await mysql2Pool.query(sql, {
            arDivisionNo,
            customerNo,
            newARDivisionNo,
            newCustomerNo
        });
        return result.affectedRows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("updateCustomer()", err.message);
            return Promise.reject(err);
        }
        debug("updateCustomer()", err);
        return Promise.reject(new Error('Error in updateCustomer()'));
    }
}
async function genericTableHandler(userId, table, from, to, options) {
    try {
        const start = new Date().valueOf();
        const response = {
            table,
            ...emptyResponse
        };
        if (options.dryRun) {
            response.remaining = response.affectedRows = await checkExisting(table, from);
            response.duration = new Date().valueOf() - start;
            return response;
        }
        response.remaining = await checkExisting(table, from);
        if (response.remaining > 0) {
            response.affectedRows = await updateCustomer(table, from, to);
        }
        response.remaining = await checkExisting(table, from);
        if (!options.deferLogging) {
            await logRenumberResult({ userId, table, from, to, result: response });
        }
        return response;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("genericTableHandler()", err.message);
            return Promise.reject(err);
        }
        debug("genericTableHandler()", err);
        return Promise.reject(new Error('Error in genericTableHandler()'));
    }
}
export async function deleteRemainingHandler(userId, table, from, to, options) {
    try {
        const start = new Date().valueOf();
        const response = await genericTableHandler(userId, table, from, to, { ...options, deferLogging: true });
        if (options.dryRun) {
            response.duration = new Date().valueOf() - start;
            return response;
        }
        const { arDivisionNo, customerNo } = getCustomerKey(from);
        if (response.remaining) {
            // it is likely that the
            const sql = `DELETE
                         FROM ${table}
                         WHERE Company = 'chums'
                           AND ARDivisionNo = :arDivisionNo
                           AND CustomerNo = :customerNo`;
            await mysql2Pool.query(sql, { arDivisionNo, customerNo });
            response.remaining = await checkExisting(table, from);
        }
        await logRenumberResult({ userId, table, from, to, result: response });
        return response;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("deleteRemainingHandler()", err.message);
            return Promise.reject(err);
        }
        debug("deleteRemainingHandler()", err);
        return Promise.reject(new Error('Error in deleteRemainingHandler()'));
    }
}
export async function ARCustomerSalesHistory(userId, table, from, to, options) {
    try {
        const start = new Date().valueOf();
        const response = await genericTableHandler(userId, table, from, to, { ...options, deferLogging: true });
        if (options.dryRun) {
            response.duration = new Date().valueOf() - start;
            return response;
        }
        const { arDivisionNo, customerNo } = getCustomerKey(from);
        if (response.remaining) {
            // the current year will be replaced by nightly Database Updates
            const sql = `DELETE
                         FROM c2.AR_CustomerSalesHistory
                         WHERE Company = 'chums'
                           AND ARDivisionNo = :arDivisionNo
                           AND CustomerNo = :customerNo
                           AND FiscalYear = YEAR(NOW())`;
            await mysql2Pool.query(sql, { arDivisionNo, customerNo });
            response.remaining = await checkExisting(table, from);
        }
        await logRenumberResult({ userId, table, from, to, result: response });
        return response;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("ARCustomerSalesHistory()", err.message);
            return Promise.reject(err);
        }
        debug("ARCustomerSalesHistory()", err);
        return Promise.reject(new Error('Error in ARCustomerSalesHistory()'));
    }
}
export async function ARAlternativeInvoiceHandler(userId, table, from, to, options) {
    try {
        const start = new Date().valueOf();
        const response = await genericTableHandler(userId, table, from, to, { ...options, deferLogging: true });
        if (options.dryRun) {
            response.duration = new Date().valueOf() - start;
            return response;
        }
        const { arDivisionNo, customerNo } = getCustomerKey(from);
        if (response.remaining) {
            // the current year will be replaced by nightly Database Updates
            const sql = `DELETE
                         FROM c2.ar_alternateinvoice
                         WHERE Company = 'chums'
                           AND ARDivisionNo = :arDivisionNo
                           AND CustomerNo = :customerNo
                           AND InvoiceDate > date_sub(NOW(), INTERVAL 1 MONTH)`;
            await mysql2Pool.query(sql, { arDivisionNo, customerNo });
            response.remaining = await checkExisting(table, from);
        }
        await logRenumberResult({ userId, table, from, to, result: response });
        return response;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("ARCustomerSalesHistory()", err.message);
            return Promise.reject(err);
        }
        debug("ARCustomerSalesHistory()", err);
        return Promise.reject(new Error('Error in ARCustomerSalesHistory()'));
    }
}
