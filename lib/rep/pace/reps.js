import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
import { Decimal } from "decimal.js";
import { loadManagedCustomers } from "./rep-customers.js";
export const REP_TOTAL = { OpenOrders: '0', InvCYTD: '0', InvPYTD: '0', InvPY: '0', InvP2TD: '0', InvP2: '0', rate: '0', pace: '0' };
const debug = Debug('chums:lib:rep:pace:reps');
const repManagerSQL = `
    SELECT mgr.Company,
           mgr.SalespersonDivisionNo,
           mgr.SalespersonNo,
           mgr.SalespersonName,
           mgr.EmailAddress,
           IF(IFNULL(mgr.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson rep
             INNER JOIN c2.ar_salesperson mgr
                        ON mgr.Company = rep.Company AND
                           mgr.SalespersonDivisionNo = rep.SalesManagerDivisionNo AND
                           mgr.SalespersonNo = rep.SalesManagerNo
    WHERE rep.Company = :Company
      AND rep.SalespersonDivisionNo = :SalespersonDivisionNo
      AND rep.SalespersonNo = :SalespersonNo`;
const repInfoSQL = `
    SELECT rep.Company,
           rep.SalespersonDivisionNo,
           rep.SalespersonNo,
           rep.SalespersonName,
           rep.EmailAddress,
           IF(IFNULL(rep.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson rep
    WHERE rep.Company = :Company
      AND rep.SalespersonDivisionNo = :SalespersonDivisionNo
      AND rep.SalespersonNo = :SalespersonNo`;
const managedRepsSQL = `
    SELECT DISTINCT s.Company,
                    s.SalespersonDivisionNo,
                    s.SalespersonNo,
                    s.SalespersonName,
                    s.EmailAddress,
                    IF(IFNULL(s.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson s
             INNER JOIN users.user_AR_Customer u
                        USING (Company, SalespersonDivisionNo, SalespersonNo)
    WHERE s.Company = :Company
      AND IFNULL(s.UDF_TERMINATED, '') <> 'Y'
      AND IFNULL(s.SalesManagerDivisionNo, '') = :SalespersonDivisionNo
      AND IFNULL(s.SalesManagerNo, '') = :SalespersonNo
      AND u.userid = :userid
      AND u.CustomerStatus = 'A'

    UNION

    SELECT DISTINCT s.Company,
                    s.SalespersonDivisionNo,
                    s.SalespersonNo,
                    s.SalespersonName,
                    s.EmailAddress,
                    IF(IFNULL(s.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson s
             INNER JOIN c2.ar_salesperson sr
                        ON sr.Company = s.Company
                            AND sr.SalesManagerDivisionNo = s.SalespersonDivisionNo
                            AND sr.SalesManagerNo = s.SalespersonNo
             INNER JOIN users.user_AR_Customer c
                        ON c.Company = sr.Company AND c.SalespersonDivisionNo = sr.SalespersonDivisionNo AND
                           c.SalespersonNo = sr.SalespersonNo
    WHERE s.Company = :Company
      AND IFNULL(s.UDF_TERMINATED, '') <> 'Y'
      AND IFNULL(s.SalesManagerDivisionNo, '') = :SalespersonDivisionNo
      AND IFNULL(s.SalesManagerNo, '') = :SalespersonNo
      AND c.userid = :userid
      AND c.CustomerStatus = 'A'

    UNION

    SELECT DISTINCT s.Company,
                    s.SalespersonDivisionNo,
                    s.SalespersonNo,
                    s.SalespersonName,
                    s.EmailAddress,
                    IF(IFNULL(s.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson s
             INNER JOIN users.user_SO_ShipToAddress c
                        USING (Company, SalespersonDivisionNo, SalespersonNo)
             INNER JOIN c2.ar_customer a
                        USING (Company, ARDivisionNo, CustomerNo)
    WHERE s.Company = :Company
      AND IFNULL(s.SalesManagerDivisionNo, '') = :SalespersonDivisionNo
      AND IFNULL(s.SalesManagerNo, '') = :SalespersonNo
      AND c.userid = :userid
      AND a.CustomerStatus = 'A'

    UNION

    SELECT DISTINCT s.Company,
                    s.SalespersonDivisionNo,
                    s.SalespersonNo,
                    s.SalespersonName,
                    s.EmailAddress,
                    IF(IFNULL(s.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson s
             INNER JOIN c2.ar_salesperson sr
                        ON sr.Company = s.Company
                            AND sr.SalesManagerDivisionNo = s.SalespersonDivisionNo
                            AND sr.SalesManagerNo = s.SalespersonNo
             INNER JOIN users.user_SO_ShipToAddress c
                        ON c.Company = sr.Company
                            AND c.SalespersonDivisionNo = sr.SalespersonDivisionNo
                            AND c.SalespersonNo = sr.SalespersonNo
             INNER JOIN c2.ar_customer a
                        ON a.Company = c.Company AND a.ARDivisionNo = c.ARDivisionNo AND a.CustomerNo = c.CustomerNo
    WHERE s.Company = :Company
      AND IFNULL(s.SalesManagerDivisionNo, '') = :SalespersonDivisionNo
      AND IFNULL(s.SalesManagerNo, '') = :SalespersonNo
      AND c.userid = :userid

    UNION

    SELECT DISTINCT s.Company,
                    s.SalespersonDivisionNo,
                    s.SalespersonNo,
                    s.SalespersonName,
                    s.EmailAddress,
                    IF(IFNULL(s.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson s
             INNER JOIN users.user_SO_ShipToAddress c
                        USING (Company, SalespersonDivisionNo, SalespersonNo)
             INNER JOIN c2.ar_customer a
                        USING (Company, ARDivisionNo, CustomerNo)
    WHERE s.Company = :Company
      AND s.SalesManagerDivisionNo = :SalespersonDivisionNo
      AND s.SalesManagerNo = :SalespersonNo
      AND c.userid = :userid
      AND a.CustomerStatus = 'A'

    ORDER BY SalespersonDivisionNo, SalespersonNo
`;
const userRepsSQL = `
    SELECT r.Company, r.SalespersonDivisionNo, r.SalespersonNo, r.SalespersonName, r.EmailAddress
    FROM users.users u
             INNER JOIN users.accounts a
                        ON u.id = a.userid
             INNER JOIN c2.ar_salesperson r
                        ON r.Company = a.Company
                            AND r.SalespersonDivisionNo LIKE a.SalespersonDivisionNo
                            AND r.SalespersonNo LIKE a.SalespersonNo
    WHERE u.id = :userid
      AND a.Company = 'chums'
      AND u.accountType = 2
`;
const availableRepsSQL = `
    SELECT DISTINCT c.SalespersonDivisionNo, c.SalespersonNo, rep.SalespersonName, rep.EmailAddress
    FROM users.user_AR_Customer c
             INNER JOIN c2.ar_salesperson rep
                        USING (Company, SalespersonDivisionNo, SalespersonNo)
    WHERE c.company = 'chums'
      AND c.userid = :userid
      AND rep.UDF_TERMINATED <> 'Y'

    UNION

    SELECT DISTINCT s.SalespersonDivisionNo, s.SalespersonNo, rep.SalespersonName, rep.EmailAddress
    FROM users.user_SO_ShipToAddress s
             INNER JOIN c2.ar_salesperson rep
                        USING (Company, SalespersonDivisionNo, SalespersonNo)
    WHERE s.company = 'chums'
      AND s.userid = :userid
      AND rep.UDF_TERMINATED <> 'Y'
    ORDER BY SalespersonDivisionNo, SalespersonNo
`;
export async function loadRepInfo({ Company, SalespersonDivisionNo, SalespersonNo }) {
    try {
        const [rows] = await mysql2Pool.query(repInfoSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo
        });
        if (rows[0]) {
            const rep = rows[0];
            rep.Active = !!rep.Active;
            rep.manager = await loadRepManagers({ ...rep });
            rep.total = { ...REP_TOTAL };
            return rep;
        }
        return null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadRepInfo()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepInfo()", err);
        return Promise.reject(new Error('Error in loadRepInfo()'));
    }
}
export async function loadUserReps(userid) {
    try {
        const [rows] = await mysql2Pool.query(availableRepsSQL, { userid });
        return rows.map(row => ({
            ...row,
            Active: !!row.Active,
            manager: null,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadUserReps()", err.message);
            return Promise.reject(err);
        }
        debug("loadUserReps()", err);
        return Promise.reject(new Error('Error in loadUserReps()'));
    }
}
export async function loadRepManagers({ Company, SalespersonDivisionNo, SalespersonNo }) {
    try {
        const [rows] = await mysql2Pool.query(repManagerSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo
        });
        if (rows.length === 0) {
            return null;
        }
        const rep = rows[0];
        rep.Active = !!rep.Active;
        rep.manager = await loadRepManagers({ ...rep });
        return rep;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadRepManagers()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepManagers()", err);
        return Promise.reject(new Error('Error in loadRepManagers()'));
    }
}
export async function loadUserRep(userid) {
    try {
        const [rows] = await mysql2Pool.query(userRepsSQL, { userid });
        if (!rows.length) {
            return null;
        }
        const rep = rows[0];
        rep.Active = !!rep.Active;
        rep.manager = null;
        return rep;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadUserRep()", err.message);
            return Promise.reject(err);
        }
        debug("loadUserRep()", err);
        return Promise.reject(new Error('Error in loadUserRep()'));
    }
}
export async function loadManagedReps({ Company, SalespersonDivisionNo, SalespersonNo, userid }) {
    try {
        const [rows] = await mysql2Pool.query(managedRepsSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo,
            userid
        });
        return rows.map(row => ({
            ...row,
            Active: !!row.Active,
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadManagedReps()", err.message);
            return Promise.reject(err);
        }
        debug("loadManagedReps()", err);
        return Promise.reject(new Error('Error in loadManagedReps()'));
    }
}
export async function loadRepPace({ Company, SalespersonDivisionNo = '', SalespersonNo = '', minDate, maxDate, userid = 0, groupByCustomer = false }) {
    try {
        let rep = await loadRepInfo({ Company, SalespersonDivisionNo, SalespersonNo });
        let pace;
        if (!rep) {
            const user = await loadUserRep(userid);
            if (!user) {
                return null;
            }
            SalespersonDivisionNo = user.SalespersonDivisionNo;
            SalespersonNo = user.SalespersonNo;
            rep = await loadRepInfo({ Company, SalespersonDivisionNo, SalespersonNo });
        }
        if (!rep) {
            return null;
        }
        rep.total = { ...REP_TOTAL };
        const subReps = await loadManagedReps({ Company, SalespersonDivisionNo, SalespersonNo, userid });
        const repCustomers = await loadManagedCustomers({
            Company,
            SalespersonDivisionNo,
            SalespersonNo,
            minDate,
            maxDate,
            groupByCustomer
        });
        repCustomers.forEach(row => {
            rep.total.OpenOrders = new Decimal(rep?.total.OpenOrders ?? 0).add(row.OpenOrders).toDecimalPlaces(4).toString();
            rep.total.InvCYTD = new Decimal(rep?.total.InvCYTD ?? 0).add(row.InvCYTD).toDecimalPlaces(4).toString();
            rep.total.InvPYTD = new Decimal(rep?.total.InvPYTD ?? 0).add(row.InvPYTD).toDecimalPlaces(4).toString();
            rep.total.InvPY = new Decimal(rep?.total.InvPY ?? 0).add(row.InvPY).toDecimalPlaces(4).toString();
            rep.total.InvP2TD = new Decimal(rep?.total.InvP2TD ?? 0).add(row.InvP2TD).toDecimalPlaces(4).toString();
            rep.total.InvP2 = new Decimal(rep?.total.InvP2 ?? 0).add(row.InvP2).toDecimalPlaces(4).toString();
        });
        const repSubReps = await Promise.all(subReps.map(rep => loadRepPace({ ...rep, minDate, maxDate, userid })));
        repSubReps.forEach(sr => {
            if (!!sr && sr.rep) {
                rep.total.OpenOrders = new Decimal(rep?.total?.OpenOrders ?? 0).add(sr.rep.total.OpenOrders).toDecimalPlaces(4).toString();
                rep.total.InvCYTD = new Decimal(rep?.total?.InvCYTD ?? 0).add(sr.rep.total.InvCYTD).toDecimalPlaces(4).toString();
                rep.total.InvPYTD = new Decimal(rep?.total?.InvPYTD ?? 0).add(sr.rep.total.InvPYTD).toDecimalPlaces(4).toString();
                rep.total.InvPY = new Decimal(rep?.total?.InvPY ?? 0).add(sr.rep.total.InvPY).toDecimalPlaces(4).toString();
                rep.total.InvP2TD = new Decimal(rep?.total?.InvP2TD ?? 0).add(sr.rep.total.InvP2TD).toDecimalPlaces(4).toString();
                rep.total.InvP2 = new Decimal(rep?.total?.InvP2 ?? 0).add(sr.rep.total.InvP2).toDecimalPlaces(4).toString();
            }
        });
        rep.total.rate = rep.total.InvPYTD === 0
            ? (new Decimal(rep.total.InvCYTD).lte(0) ? 0 : 1)
            : new Decimal(rep.total.InvCYTD).sub(rep.total.InvPYTD).div(rep.total.InvPYTD).toDecimalPlaces(4).toString();
        rep.total.pace = new Decimal(rep.total.InvPY).eq(0)
            ? new Decimal(rep.total.InvCYTD).add(rep.total.OpenOrders).toDecimalPlaces(4).toString()
            : new Decimal(rep.total.rate).add(1).times(rep.total.InvPY).toDecimalPlaces(4).toString();
        return { userid, rep, repSubReps, repCustomers };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadRepPace()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepPace()", err);
        return Promise.reject(new Error('Error in loadRepPace()'));
    }
}
