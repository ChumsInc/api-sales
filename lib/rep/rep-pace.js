import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import Decimal from "decimal.js";
import dayjs from "dayjs";
import {calcGrowthRate, calcPace} from "./pace/utils.js";

const debug = Debug('chums:lib:sales:rep:rep-pace');
export const REP_TOTAL = {OpenOrders: 0, InvCYTD: 0, InvPYTD: 0, InvPY: 0, InvP2TD: 0, InvP2: 0, rate: 0, pace: 0};


const repManagerSQL = `
    SELECT mgr.Company, mgr.SalespersonDivisionNo, mgr.SalespersonNo, mgr.SalespersonName, mgr.EmailAddress
    FROM c2.ar_salesperson rep
             INNER JOIN c2.ar_salesperson mgr
                        ON mgr.Company = rep.Company
                            AND mgr.SalespersonDivisionNo = rep.SalesManagerDivisionNo
                            AND mgr.SalespersonNo = rep.SalesManagerNo
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
    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName, s.EmailAddress
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName, s.EmailAddress
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName, s.EmailAddress
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName, s.EmailAddress
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName, s.EmailAddress
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
      AND a.Company = :Company
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
`

const managedCustomersSQL = `
    SELECT t.Company,
           :SalespersonDivisionNo                   AS SalespersonDivisionNo,
           :SalespersonNo                           AS SalespersonNo,
           IF(:groupByCustomer, t.ARDivisionNo, '') AS ARDivisionNo,
           IF(:groupByCustomer, t.CustomerNo, '')   AS CustomerNo,
           IF(:groupByCustomer, t.ShipToCode, '')   AS ShipToCode,
           IF(:groupByCustomer, t.CustomerName, '') AS CustomerName,
           IF(:groupByCustomer, t.EmailAddress, '') AS EmailAddress,
           SUM(t.OpenOrders)                        AS OpenOrders,
           SUM(t.InvCYTD)                           AS InvCYTD,
           SUM(t.InvPYTD)                           AS InvPYTD,
           SUM(t.InvPY)                             AS InvPY,
           SUM(t.InvP2TD)                           AS InvP2TD,
           SUM(t.InvP2)                             AS InvP2
    FROM (SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 ''         AS ShipToCode,
                 c.CustomerName,
                 c.EmailAddress,
                 0          AS OpenOrders,
                 SUM(IF(h.InvoiceDate BETWEEN :minDate AND :maxDate,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvCYTD,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 1 YEAR) AND SUBDATE(:maxDate, INTERVAL 1 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvPYTD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 1,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvPY,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 2 YEAR) AND SUBDATE(:maxDate, INTERVAL 2 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvP2TD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 2,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0)) AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.ar_invoicehistoryheader h
                              USING (Company, ARDivisionNo, CustomerNo)
                   LEFT JOIN c2.SO_ShipToAddress s USING (Company, ARDivisionNo, CustomerNo, ShipToCode)

          WHERE h.Company = :Company
            AND c.SalespersonDivisionNo = :SalespersonDivisionNo
            AND c.SalespersonNo = :SalespersonNo
            AND IFNULL(s.SalespersonDivisionNo, c.SalespersonDivisionNo) = c.SalespersonDivisionNo
            AND IFNULL(s.SalespersonNo, c.SalespersonNo) = c.SalespersonNo
            AND (
              h.InvoiceDate BETWEEN :minDate AND :maxDate
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 1
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 2
              )
            AND h.InvoiceType <> 'XD'
          GROUP BY Company, ARDivisionNo, CustomerNo

          UNION

          SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 IFNULL(s.ShipToCode, '') AS ShipToCode,
                 s.ShipToName,
                 s.EmailAddress,
                 0                        AS OpenOrders,
                 SUM(IF(h.InvoiceDate BETWEEN :minDate AND :maxDate,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvCYTD,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 1 YEAR) AND SUBDATE(:maxDate, INTERVAL 1 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvPYTD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 1,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvPY,
                 SUM(IF(h.InvoiceDate BETWEEN SUBDATE(:minDate, INTERVAL 2 YEAR) AND SUBDATE(:maxDate, INTERVAL 2 YEAR),
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvP2TD,
                 SUM(IF(YEAR(h.InvoiceDate) = YEAR(:minDate) - 2,
                        h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt,
                        0))               AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.SO_ShipToAddress s
                              USING (Company, ARDivisionNo, CustomerNo)
                   INNER JOIN c2.ar_invoicehistoryheader h
                              USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
          WHERE h.Company = :Company
            AND s.SalespersonDivisionNo = :SalespersonDivisionNo
            AND s.SalespersonNo = :SalespersonNo
            AND (
              h.InvoiceDate BETWEEN :minDate AND :maxDate
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 1
                  OR YEAR(h.InvoiceDate) = YEAR(:minDate) - 2
              )
            AND h.InvoiceType <> 'XD'
            AND (c.SalespersonDivisionNo <> s.SalespersonDivisionNo OR c.SalespersonNo <> s.SalespersonNo)
          GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode

          UNION

          SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 ''                                                  AS ShipToCode,
                 c.CustomerName,
                 c.EmailAddress,
                 SUM(h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt) AS OpenOrders,
                 0                                                   AS InvCYTD,
                 0                                                   AS INVPYTD,
                 0                                                   AS InvPY,
                 0                                                   AS InvP2TD,
                 0                                                   AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.SO_SalesOrderHeader h
                              USING (Company, ARDivisionNo, CustomerNo)
                   LEFT JOIN c2.SO_ShipToAddress s USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
          WHERE h.Company = :Company
            AND c.SalespersonDivisionNo = :SalespersonDivisionNo
            AND c.SalespersonNo = :SalespersonNo
            AND h.OrderType IN ('B', 'S')
            AND YEAR(h.ShipExpireDate) <= YEAR(:maxDate)
            AND IFNULL(s.SalespersonDivisionNo, c.SalespersonDivisionNo) = c.SalespersonDivisionNo
            AND IFNULL(s.SalespersonNo, c.SalespersonNo) = c.SalespersonNo
          GROUP BY Company, ARDivisionNo, CustomerNo

          UNION

          SELECT c.Company,
                 c.ARDivisionNo,
                 c.CustomerNo,
                 IFNULL(s.ShipToCode, '')                            AS ShipToCode,
                 s.ShipToName,
                 s.EmailAddress,
                 SUM(h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt) AS OpenOrders,
                 0                                                   AS InvCYTD,
                 0                                                   AS INVPYTD,
                 0                                                   AS InvPY,
                 0                                                   AS InvP2TD,
                 0                                                   AS InvP2
          FROM c2.ar_customer c
                   INNER JOIN c2.SO_ShipToAddress s
                              USING (Company, ARDivisionNo, CustomerNo)
                   INNER JOIN c2.SO_SalesOrderHeader h
                              USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
          WHERE h.Company = :Company
            AND s.SalespersonDivisionNo = :SalespersonDivisionNo
            AND s.SalespersonNo = :SalespersonNo
            AND h.OrderType IN ('B', 'S')
            AND YEAR(h.ShipExpireDate) <= YEAR(:maxDate)
            AND (c.SalespersonDivisionNo <> s.SalespersonDivisionNo OR c.SalespersonNo <> s.SalespersonNo)
          GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) t
    GROUP BY Company,
             IF(:groupByCustomer, ARDivisionNo, ''),
             IF(:groupByCustomer, CustomerNo, ''),
             IF(:groupByCustomer, ShipToCode, '')
    ORDER BY InvCYTD DESC, INVPY DESC, INVP2 DESC
`;

async function loadRepInfo({Company, SalespersonDivisionNo, SalespersonNo}) {
    try {
        const [rows] = await mysql2Pool.query(repInfoSQL, {Company, SalespersonDivisionNo, SalespersonNo});
        if (rows[0]) {
            const rep = rows[0];
            rep.manager = await loadRepManagers({...rep});
            return rep;
        }
        return {};
    } catch (err) {
        debug("loadRepInfo()", err.message);
        return err;
    }
}

async function loadUserReps(userid) {
    try {
        const [rows] = await mysql2Pool.query(availableRepsSQL, {userid});
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadUserReps()", err.message);
            return Promise.reject(err);
        }
        debug("loadUserReps()", err);
        return Promise.reject(new Error('Error in loadUserReps()'));
    }
}

export async function loadRepPace({
                                      Company,
                                      SalespersonDivisionNo = '',
                                      SalespersonNo = '',
                                      minDate,
                                      maxDate,
                                      userid,
                                      groupByCustomer = false
                                  }) {
    try {
        let rep = await loadRepInfo({Company, SalespersonDivisionNo, SalespersonNo});
        const [[user]] = await mysql2Pool.query(userRepsSQL, {Company, userid});
        if (!SalespersonDivisionNo && !!user) {
            SalespersonDivisionNo = user.SalespersonDivisionNo;
            SalespersonNo = user.SalespersonNo;
            rep = await loadRepInfo({Company, SalespersonDivisionNo, SalespersonNo});
        }
        rep.total = {...REP_TOTAL};
        const [subReps] = await mysql2Pool.query(managedRepsSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo,
            userid
        });

        const [repCustomers] = await mysql2Pool.query(managedCustomersSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo,
            minDate,
            maxDate,
            groupByCustomer
        });
        repCustomers.forEach(row => {
            row.rate = new Decimal(row.InvPYTD).eq(0)
                ? (new Decimal(row.InvCYTD).lte(0) ? 0 : 1)
                : new Decimal(row.InvCYTD).sub(row.InvPYTD).div(row.InvPYTD).toDecimalPlaces(4).toString();
            row.rate = calcGrowthRate(row.InvCYTD, row.InvPYTD).toDecimalPlaces(4).toString();
            row.pace = new Decimal(row.InvPY).eq(0)
                ? new Decimal(row.InvCYTD).add(row.OpenOrders).toString()
                : new Decimal(row.rate).add(1).times(row.InvPY).toDecimalPlaces(4).toString();

            rep.total.OpenOrders = new Decimal(rep.total.OpenOrders).add(row.OpenOrders).toString();
            rep.total.InvCYTD = new Decimal(rep.total.InvCYTD).add(row.InvCYTD).toString();
            rep.total.InvPYTD = new Decimal(rep.total.InvPYTD).add(row.InvPYTD).toString();
            rep.total.InvPY = new Decimal(rep.total.InvPY).add(row.InvPY).toString();
            rep.total.InvP2TD = new Decimal(rep.total.InvP2TD).add(row.InvP2TD).toString();
            rep.total.InvP2 = new Decimal(rep.total.InvP2).add(row.InvP2).toString();
        })

        const repSubReps = await Promise.all(subReps.map(rep => loadRepPace({...rep, minDate, maxDate, userid})));
        repSubReps.forEach(sr => {
            rep.total.OpenOrders = new Decimal(rep.total.OpenOrders).add(sr.rep.total.OpenOrders).toString();
            rep.total.InvCYTD = new Decimal(rep.total.InvCYTD).add(sr.rep.total.InvCYTD).toString();
            rep.total.InvPYTD = new Decimal(rep.total.InvPYTD).add(sr.rep.total.InvPYTD).toString();
            rep.total.InvPY = new Decimal(rep.total.InvPY).add(sr.rep.total.InvPY).toString();
            rep.total.InvP2TD = new Decimal(rep.total.InvP2TD).add(sr.rep.total.InvP2TD).toString();
            rep.total.InvP2 = new Decimal(rep.total.InvP2).add(sr.rep.total.InvP2).toString();
        });
        rep.total.rate = new Decimal(rep.total.InvPYTD).eq(0)
            ? (new Decimal(rep.total.InvPYTD).lte(0) ? 0 : 1)
            : new Decimal(rep.total.InvCYTD).sub(rep.total.InvPYTD).div(rep.total.InvPYTD).toDecimalPlaces(4).toString();
        rep.total.pace = new Decimal(rep.total.InvPY).eq(0)
            ? new Decimal(rep.total.InvCYTD).add(rep.total.OpenOrders).toDecimalPlaces(4).toString()
            : new Decimal(rep.total.rate).add(1).times(rep.total.InvPY).toDecimalPlaces(4).toString()

        // rep.total.rate = rep.total.InvPYTD === 0 ? (rep.total.InvCYTD <= 0 ? 0 : 1) : (((rep.total.InvCYTD - rep.total.InvPYTD) / rep.total.InvPYTD));
        // rep.total.pace = rep.total.InvPY === 0 ? (rep.total.InvCYTD + rep.total.OpenOrders) : ((1 + rep.total.rate) * rep.total.InvPY);

        return {userid, rep, repSubReps, repCustomers};
    } catch (err) {
        debug("loadRepPace() error", err.message, err);
        return err;
    }
}


async function loadRepManagers({Company, SalespersonDivisionNo, SalespersonNo}) {
    try {
        const [rows] = await mysql2Pool.query(repManagerSQL, {Company, SalespersonDivisionNo, SalespersonNo});
        if (rows.length === 0) {
            return;
        }
        const rep = rows[0];
        rep.manager = await loadRepManagers({...rep})
        return rep;
    } catch (err) {
        debug("loadRepManagers()", err.message);
        return err;
    }
}

async function getRepList(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const reps = loadUserReps(userid);
        res.json({reps});
    } catch (err) {
        if (err instanceof Error) {
            debug("getRepList()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getRepList'});
    }
}

export async function getRepPace(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const pace = await loadRepPace({...req.query, ...req.params, groupByCustomer: true, userid});
        res.json({pace});
    } catch (err) {
        debug("getRepPace()", err.message);
        res.json({error: err.message});
    }
}

export async function getRepPace_v2(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;

        const minDate = req.query.minDate && dayjs(req.query.minDate).isValid()
            ? req.query.minDate
            : dayjs().startOf('year').format('YYYY-MM-DD');

        const maxDate = req.query.maxDate && dayjs(req.query.maxDate).isValid()
            ? req.query.maxDate
            : dayjs().format('YYYY-MM-DD');

        const [salespersonDivisionNo, salespersonNo] = /0[1-9]-\w+/.test(req.query.rep ?? '') ? req.query.rep.split('-') : [undefined, undefined];

        const params = {
            Company: 'chums',
            SalespersonDivisionNo: salespersonDivisionNo,
            SalespersonNo: salespersonNo,
            minDate: minDate,
            maxDate: maxDate,
            userid,
            groupByCustomer: true,
        }
        const pace = await loadRepPace(params);
        res.json({pace});
    } catch(err) {
        if (err instanceof Error) {
            debug("getRepPaceV2()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getRepPaceV2'});
    }
}

export async function getRepManagers(req, res) {
    try {
        const rep = await loadRepInfo({...req.params});
        rep.manager = await loadRepManagers({...rep});
        res.json({rep});
    } catch (err) {
        debug("getRepManagers()", err.message);
        res.json({error: err.message});
    }
}

