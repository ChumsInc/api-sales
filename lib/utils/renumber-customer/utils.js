import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:utils:renumber-customer:utils');
export function getCustomerKey(customer) {
    if (customer.includes('-')) {
        const [arDivisionNo, customerNo] = customer.split('-');
        return { arDivisionNo, customerNo };
    }
    const arDivisionNo = customer.slice(0, 2);
    const customerNo = customer.slice(2);
    return { arDivisionNo, customerNo };
}
export const validARDivisionNo = /^(0[1-9]|10)$/;
export const validCustomerNo = /^[A-Z0-9.]{4,}$/;
export async function validateCustomerRename(customer) {
    try {
        const sql = `SELECT ARDivisionNo,
                            CustomerNo,
                            CustomerName,
                            CustomerStatus,
                            InactiveReasonCode
                     FROM c2.ar_customer
                     WHERE Company = 'chums'
                       AND ARDivisionNo = :arDivisionNo
                       AND CustomerNo = :customerNo`;
        const { arDivisionNo, customerNo } = getCustomerKey(customer);
        if (!validARDivisionNo.test(arDivisionNo)) {
            return Promise.reject(new Error(`Invalid ARDivisionNo: ${customer}`));
        }
        if (!validCustomerNo.test(customerNo)) {
            return Promise.reject(new Error(`Invalid CustomerNo: ${customer}`));
        }
        const [rows] = await mysql2Pool.query(sql, { arDivisionNo, customerNo });
        return rows[0] ?? null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("validateCustomerRename()", err.message);
            return Promise.reject(err);
        }
        debug("validateCustomerRename()", err);
        return Promise.reject(new Error('Error in validateCustomerRename()'));
    }
}
export function isFulfilledResponse(response) {
    return response.status === 'fulfilled';
}
export function isRejectedResponse(response) {
    return response.status === 'rejected';
}
