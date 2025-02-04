import {mysql2Pool} from "chums-local-modules";
import Debug from "debug";
import {ChangedRowResponse} from "./types.js";
import {getCustomerKey} from "./utils.js";

const debug = Debug('chums:lib:utils:renumber-customer:logger');

export interface LogResultProps {
    userId: number;
    table: string;
    from: string;
    to: string;
    result: ChangedRowResponse;
}

export const logRenumberResult = async ({userId, table, from, to, result}: LogResultProps) => {
    try {
        const {remaining, affectedRows} = result;
        const {arDivisionNo, customerNo} = getCustomerKey(from);
        const {arDivisionNo: newARDivisionNo, customerNo: newCustomerNo} = getCustomerKey(to);
        const query = `INSERT INTO c2.audit_rename_customer
                       (userID, tableName, 
                        Company, ARDivisionNo, CustomerNo, 
                        newARDivisionNo, newCustomerNo, 
                        results)
                       VALUES (:userId, :table, 
                               'chums', :arDivisionNo, :customerNo, 
                               :newARDivisionNo, :newCustomerNo,
                               :results)`;
        const data = {
            userId, table,
            arDivisionNo, customerNo,
            newARDivisionNo, newCustomerNo,
            results: JSON.stringify({affectedRows, remaining})
        };
        await mysql2Pool.query(query, data);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("logRenumberResult()", err.message);
            return Promise.reject(err);
        }
        debug("logResult()", err);
        return Promise.reject(new Error('Error in logRenumberResult()'));
    }
};
