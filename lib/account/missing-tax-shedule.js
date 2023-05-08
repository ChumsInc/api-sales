import Debug from 'debug';
import {mysql2Pool} from "chums-local-modules";

const debug = Debug('chums:lib:account:missing-tax-schedule');

const sql = `SELECT c.ARDivisionNo,
                    c.CustomerNo,
                    c.CustomerName,
                    c.City,
                    c.State,
                    c.SalespersonDivisionNo,
                    c.SalespersonNo,
                    u.company as UserName,
                    'B2B Customer - missing Tax Schedule' AS error,
                    1 as sortPriority
             FROM c2.ar_customer c
                  INNER JOIN users.user_accounts a
                             ON a.Company = c.Company AND a.ARDivisionNo = c.ARDivisionNo AND
                                a.CustomerNo = c.CustomerNo
                  INNER JOIN users.users u
                             ON u.id = a.userid
             WHERE c.Company = 'chums'
               AND c.TaxSchedule IS NULL
               AND c.ARDivisionNo <> '00'
               AND c.CustomerStatus = 'A'
               AND u.accountType = 4
            

             UNION

             SELECT c.ARDivisionNo,
                    c.CustomerNo,
                    c.CustomerName,
                    c.City,
                    c.State,
                    c.SalespersonDivisionNo,
                    c.SalespersonNo,
                    s.SalespersonName,
                    'Rep Customer - missing Tax Schedule',
                    2 as sortPriority
             FROM c2.ar_customer c
                  INNER JOIN c2.ar_salesperson s
                             ON s.Company = c.Company AND s.SalespersonDivisionNo = c.SalespersonDivisionNo AND
                                s.SalespersonNo = c.SalespersonNo
                  INNER JOIN users.user_accounts a
                             ON a.Company = c.Company AND c.SalespersonDivisionNo LIKE a.SalespersonDivisionNo AND
                                c.SalespersonNo LIKE a.SalespersonNo
                  INNER JOIN users.users u
                             ON u.id = a.userid
             WHERE c.Company = 'chums'
               AND c.TaxSchedule IS NULL
               AND c.ARDivisionNo <> '00'
               AND c.CustomerStatus = 'A'
               AND u.accountType = 2
               AND u.active = 1
               AND c.SalespersonNo NOT IN ('0000', 'H00', 'H01', 'H02', 'H04')
               
            ORDER BY sortPriority, ARDivisionNo, CustomerNo, SalespersonNo
               `;

export async function loadMissingTaxSchedules() {
    try {
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    } catch(err) {
        if (err instanceof Error) {
            debug("loadMissingTaxSchedules()", err.message);
            return Promise.reject(err);
        }
        debug("loadMissingTaxSchedules()", err);
        return Promise.reject(new Error('Error in loadMissingTaxSchedules()'));
    }
}
