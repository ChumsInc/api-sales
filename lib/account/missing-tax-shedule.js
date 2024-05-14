import Debug from 'debug';
import {mysql2Pool} from "chums-local-modules";

const debug = Debug('chums:lib:account:missing-tax-schedule');

const sql = `SELECT c.ARDivisionNo,
                    c.CustomerNo,
                    NULL                                  AS ShipToCode,
                    c.CustomerName,
                    c.City,
                    c.State,
                    c.SalespersonDivisionNo,
                    c.SalespersonNo,
                    u.company                             AS UserName,
                    'B2B Customer - missing Tax Schedule' AS error,
                    1                                     AS sortPriority
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
                    st.ShipToCode,
                    st.ShipToName,
                    st.ShipToCity,
                    st.ShipToState,
                    st.SalespersonDivisionNo,
                    st.SalespersonNo,
                    u.company                                    AS UserName,
                    'B2B Customer ShipTo - missing Tax Schedule' AS error,
                    1                                            AS sortPriority
             FROM c2.ar_customer c
                      INNER JOIN c2.SO_ShipToAddress st
                                 ON st.Company = c.Company AND st.ARDivisionNo = c.ARDivisionNo AND
                                    st.CustomerNo = c.CustomerNo
                      INNER JOIN users.user_accounts a
                                 ON a.Company = st.Company AND a.ARDivisionNo = st.ARDivisionNo AND
                                    a.CustomerNo = st.CustomerNo AND
                                    (a.ShipToCode IS NULL OR a.ShipToCode = st.ShipToCode)
                      INNER JOIN users.users u
                                 ON u.id = a.userid
             WHERE c.Company = 'chums'
               AND st.TaxSchedule IS NULL
               AND c.ARDivisionNo <> '00'
               AND c.CustomerStatus = 'A'
               AND u.accountType = 4

             UNION

             SELECT c.ARDivisionNo,
                    c.CustomerNo,
                    NULL AS ShipToCode,
                    c.CustomerName,
                    c.City,
                    c.State,
                    c.SalespersonDivisionNo,
                    c.SalespersonNo,
                    s.SalespersonName,
                    'Rep Customer - missing Tax Schedule',
                    2    AS sortPriority
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

             UNION

             SELECT c.ARDivisionNo,
                    c.CustomerNo,
                    st.ShipToCode,
                    st.ShipToName,
                    st.ShipToCity,
                    st.ShipToState,
                    st.SalespersonDivisionNo,
                    st.SalespersonNo,
                    s.SalespersonName,
                    'Rep ShipTo Customer - missing Tax Schedule',
                    2 AS sortPriority
             FROM c2.ar_customer c
                      INNER JOIN c2.SO_ShipToAddress st
                                 ON st.Company = c.Company AND st.ARDivisionNo = c.ARDivisionNo AND
                                    st.CustomerNo = c.CustomerNo
                      INNER JOIN c2.ar_salesperson s
                                 ON s.Company = c.Company AND s.SalespersonDivisionNo = st.SalespersonDivisionNo AND
                                    s.SalespersonNo = st.SalespersonNo
                      INNER JOIN users.user_accounts a
                                 ON a.Company = st.Company AND st.SalespersonDivisionNo LIKE a.SalespersonDivisionNo AND
                                    st.SalespersonNo LIKE a.SalespersonNo AND
                                    (a.ShipToCode IS NULL OR a.ShipToCode = st.ShipToCode)
                      INNER JOIN users.users u
                                 ON u.id = a.userid
             WHERE c.Company = 'chums'
               AND st.TaxSchedule IS NULL
               AND c.ARDivisionNo <> '00'
               AND c.CustomerStatus = 'A'
               AND u.accountType = 2
               AND u.active = 1
               AND st.SalespersonNo NOT IN ('0000', 'H00', 'H01', 'H02', 'H04')

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
