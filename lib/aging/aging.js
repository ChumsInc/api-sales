import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
import { Decimal } from "decimal.js";
const debug = Debug('chums:lib:aging:aging');
export async function loadRepAging(args) {
    try {
        const sql = `
            SELECT s.SalespersonDivisionNo,
                   s.SalespersonNo,
                   s.SalespersonName,
                   COUNT(*)            AS accounts,
                   1                   AS reps,
                   SUM(CurrentBalance) AS CurrentBalance,
                   SUM(AgingCategory1) AS AgingCategory1,
                   SUM(AgingCategory2) AS AgingCategory2,
                   SUM(AgingCategory3) AS AgingCategory3,
                   SUM(AgingCategory4) AS AgingCategory4,
                   SUM(OpenOrderAmt)   AS OpenOrderAmt
            FROM c2.ar_customer c
                     INNER JOIN c2.ar_salesperson s
                                ON s.Company = c.Company
                                    AND s.SalespersonDivisionNo = c.SalespersonDivisionNo
                                    AND s.SalespersonNo = c.SalespersonNo
                     INNER JOIN users.accounts a
                                ON (
                                        (s.Company LIKE a.Company
                                            AND s.SalespersonDivisionNo LIKE a.ARDivisionNo
                                            AND s.salespersonno LIKE a.CustomerNo
                                            AND a.isRepAccount = 1)
                                        OR (s.Company LIKE a.Company
                                        AND s.SalesManagerDivisionNo LIKE a.ARDivisionNo
                                        AND s.SalesManagerNo LIKE a.CustomerNo
                                        AND a.isRepAccount = 1
                                            ))
                     LEFT JOIN c2.ar_termscode t
                               ON t.Company = c.Company
                                   AND t.TermsCode = c.TermsCode
            WHERE c.Company = 'chums'
              AND (ifnull(:salespersonDivisionNo, '') = '' OR s.SalespersonDivisionNo = :salespersonDivisionNo)
              AND (IFNULL(:salespersonNo, '') = '' OR s.SalespersonNo = :salespersonNo)
              AND IFNULL(s.UDF_TERMINATED, '') <> 'Y'
              AND c.CustomerStatus = 'A'
              AND a.userid = :userId
              AND a.primaryAccount = 1
              GROUP BY s.SalespersonDivisionNo, s.SalespersonNo
        `;
        debug('loadRepAging()', args);
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            TotalDue: new Decimal(row.CurrentBalance ?? 0)
                .add(row.AgingCategory1 ?? 0)
                .add(row.AgingCategory2 ?? 0)
                .add(row.AgingCategory3 ?? 0)
                .add(row.AgingCategory4 ?? 0)
                .toString()
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug('loadRepAging()', err.message);
            return Promise.reject(err);
        }
        debug("loadRepAccountAging()", err);
        return Promise.reject(new Error('Error in loadRepAccountAging()'));
    }
}
export async function loadRepCustomerAging(args) {
    try {
        const sql = `
        SELECT c.ARDivisionNo, c.CustomerNo, c.CustomerName,
        t.TermsCodeDesc,
        CurrentBalance,
        AgingCategory1,
        AgingCategory2,
        AgingCategory3,
        AgingCategory4,
        OpenOrderAmt
        FROM c2.ar_customer c
        INNER JOIN c2.ar_salesperson s
          ON s.Company = c.Company
          AND s.SalespersonDivisionNo = c.SalespersonDivisionNo
          AND s.SalespersonNo = c.SalespersonNo
        INNER JOIN users.accounts a
          on (
              (a.Company like s.Company
                and s.SalespersonDivisionNo like a.ARDivisionNo
                and s.salespersonno like a.CustomerNo
                and a.isRepAccount = 1)
              OR (a.Company like s.Company
                and s.SalesManagerDivisionNo like a.ARDivisionNo
                and s.SalesManagerNo like a.CustomerNo
                and a.isRepAccount = 1
                ))
        LEFT JOIN c2.ar_termscode t
          ON t.Company = c.Company
          AND t.TermsCode = c.TermsCode
        WHERE c.Company = 'chums'
          AND c.SalespersonDivisionNo = :salespersonDivisionNo
          AND c.SalespersonNo = :salespersonNo
          AND IFNULL(s.UDF_TERMINATED, '') <> 'Y'
          AND c.CustomerStatus = 'A'
          AND a.userid = :userId
          AND a.primaryAccount = 1
        `;
        const [rows] = await mysql2Pool.query(sql, args);
        return rows.map(row => ({
            ...row,
            TotalDue: new Decimal(row.CurrentBalance ?? 0)
                .add(row.AgingCategory1 ?? 0)
                .add(row.AgingCategory2 ?? 0)
                .add(row.AgingCategory3 ?? 0)
                .add(row.AgingCategory4 ?? 0)
                .toString()
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadRepCustomerAging()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepCustomerAging()", err);
        return Promise.reject(new Error('Error in loadRepCustomerAging()'));
    }
}
