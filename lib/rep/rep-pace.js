const debug = require('debug')('chums:lib:sales:rep:rep-pace');
const {mysql2Pool} = require('chums-local-modules');
const REP_TOTAL = {OpenOrders: 0, InvCYTD: 0, InvPYTD: 0, InvPY: 0, InvP2TD: 0, InvP2: 0, rate: 0, pace: 0};


const repManagerSQL = `
    SELECT mgr.Company, mgr.SalespersonDivisionNo, mgr.SalespersonNo, mgr.SalespersonName
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
           IF(IFNULL(rep.UDF_TERMINATED, 'N') = 'N', 1, 0) AS Active
    FROM c2.ar_salesperson rep
    WHERE rep.Company = :Company
      AND rep.SalespersonDivisionNo = :SalespersonDivisionNo
      AND rep.SalespersonNo = :SalespersonNo`;

const managedRepsSQL = `
    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName
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

    SELECT DISTINCT s.Company, s.SalespersonDivisionNo, s.SalespersonNo, s.SalespersonName
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
    SELECT r.Company, r.SalespersonDivisionNo, r.SalespersonNo, r.SalespersonName
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

const managedCustomersSQL = `
    SELECT t.Company,
           :SalespersonDivisionNo                   AS SalespersonDivisionNo,
           :SalespersonNo                           AS SalespersonNo,
           IF(:groupByCustomer, t.ARDivisionNo, '') AS ARDivisionNo,
           IF(:groupByCustomer, t.CustomerNo, '')   AS CustomerNo,
           IF(:groupByCustomer, c.CustomerName, '') AS CustomerName,
           t.ShipToCode                             AS ShipToCode,
           SUM(t.OpenOrders)                        AS OpenOrders,
           SUM(t.InvCYTD)                           AS InvCYTD,
           SUM(t.InvPYTD)                           AS InvPYTD,
           SUM(t.InvPY)                             AS InvPY,
           SUM(t.InvP2TD)                           AS InvP2TD,
           SUM(t.InvP2)                             AS InvP2
    FROM (
         SELECT c.Company,
                c.ARDivisionNo,
                c.CustomerNo,
                ''         AS ShipToCode,
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
              LEFT JOIN c2.so_shiptoaddress s using (Company, ARDivisionNo, CustomerNo, ShipToCode)
         WHERE h.Company = :Company
           AND c.SalespersonDivisionNo = :SalespersonDivisionNo
           AND c.SalespersonNo = :SalespersonNo
           AND (s.SalespersonNo is null OR (s.SalespersonDivisionNo = :SalespersonDivisionNo and s.SalespersonNo = :SalespersonNo))
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
              INNER JOIN c2.so_shiptoaddress s
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
           AND NOT (
                     c.SalespersonDivisionNo = :SalespersonDivisionNo
                 AND c.SalespersonNo = :SalespersonNo
             )
         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode

         UNION

         SELECT c.Company,
                c.ARDivisionNo,
                c.CustomerNo,
                ''                                                  AS ShipToCode,
                SUM(h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt) AS OpenOrders,
                0                                                   AS InvCYTD,
                0                                                   AS INVPYTD,
                0                                                   AS InvPY,
                0                                                   AS InvP2TD,
                0                                                   AS InvP2
         FROM c2.ar_customer c
              INNER JOIN c2.SO_SalesOrderHeader h
                         USING (Company, ARDivisionNo, CustomerNo)
         WHERE h.Company = :Company
           AND c.SalespersonDivisionNo = :SalespersonDivisionNo
           AND c.SalespersonNo = :SalespersonNo
           AND h.OrderType IN ('B', 'S')
           AND YEAR(h.ShipExpireDate) <= YEAR(:maxDate)
         GROUP BY Company, ARDivisionNo, CustomerNo

         UNION

         SELECT c.Company,
                c.ARDivisionNo,
                c.CustomerNo,
                IFNULL(s.ShipToCode, '')                            AS ShipToCode,
                SUM(h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt) AS OpenOrders,
                0                                                   AS InvCYTD,
                0                                                   AS INVPYTD,
                0                                                   AS InvPY,
                0                                                   AS InvP2TD,
                0                                                   AS InvP2
         FROM c2.ar_customer c
              INNER JOIN c2.so_shiptoaddress s
                         USING (Company, ARDivisionNo, CustomerNo)
              INNER JOIN c2.SO_SalesOrderHeader h
                         USING (Company, ARDivisionNo, CustomerNo, ShipToCode)
         WHERE h.Company = :Company
           AND s.SalespersonDivisionNo = :SalespersonDivisionNo
           AND s.SalespersonNo = :SalespersonNo
           AND h.OrderType IN ('B', 'S')
           AND YEAR(h.ShipExpireDate) <= YEAR(:maxDate)
           AND NOT (
                     c.SalespersonDivisionNo = :SalespersonDivisionNo
                 AND c.SalespersonNo = :SalespersonNo
             )
         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode
         ) t
         INNER JOIN c2.ar_customer c
                    USING (Company, ARDivisionNo, CustomerNo)
    GROUP BY Company,
             IF(:groupByCustomer, ARDivisionNo, ''),
             IF(:groupByCustomer, CustomerNo, ''),
             IF(:groupByShipTo, ShipToCode, '')
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


async function loadRepPace({
                               Company,
                               SalespersonDivisionNo = '',
                               SalespersonNo = '',
                               minDate,
                               maxDate,
                               userid,
                               groupByCustomer = false,
                               groupByShipTo = false
                           }) {
    try {
        let rep = await loadRepInfo({Company, SalespersonDivisionNo, SalespersonNo});
        const connection = await mysql2Pool.getConnection();
        const [[user]] = await connection.query(userRepsSQL, {Company, userid});
        if (!SalespersonDivisionNo && !!user) {
            SalespersonDivisionNo = user.SalespersonDivisionNo;
            SalespersonNo = user.SalespersonNo;
            rep = await loadRepInfo({Company, SalespersonDivisionNo, SalespersonNo});
        }
        rep.total = {...REP_TOTAL};
        const [subReps] = await connection.query(managedRepsSQL, {
            Company,
            SalespersonDivisionNo,
            SalespersonNo,
            userid
        });

        groupByShipTo = groupByCustomer && (groupByShipTo || SalespersonDivisionNo === '02');
        const [repCustomers] = await connection.query(managedCustomersSQL, {
            Company, SalespersonDivisionNo, SalespersonNo, minDate, maxDate,
            groupByCustomer,
            groupByShipTo,
        });
        connection.release();
        repCustomers.forEach(row => {
            row.OpenOrders = Number(row.OpenOrders);
            row.InvCYTD = Number(row.InvCYTD);
            row.InvPYTD = Number(row.InvPYTD);
            row.InvPY = Number(row.InvPY);
            row.InvP2TD = Number(row.InvP2TD);
            row.InvP2 = Number(row.InvP2);
            row.rate = row.InvPYTD === 0 ? (row.InvCYTD <= 0 ? 0 : 1) : (((row.InvCYTD - row.InvPYTD) / row.InvPYTD));
            row.pace = row.InvPY === 0 ? (row.InvCYTD + row.OpenOrders) : ((1 + row.rate) * row.InvPY);

            rep.total.OpenOrders += row.OpenOrders;
            rep.total.InvCYTD += row.InvCYTD;
            rep.total.InvPYTD += row.InvPYTD;
            rep.total.InvPY += row.InvPY;
            rep.total.InvP2TD += row.InvP2TD;
            rep.total.InvP2 += row.InvP2;
        })

        const repSubReps = await Promise.all(subReps.map(rep => loadRepPace({...rep, minDate, maxDate, userid})));
        repSubReps.forEach(sr => {
            rep.total.OpenOrders += sr.rep.total.OpenOrders;
            rep.total.InvCYTD += sr.rep.total.InvCYTD;
            rep.total.InvPYTD += sr.rep.total.InvPYTD;
            rep.total.InvPY += sr.rep.total.InvPY;
            rep.total.InvP2TD += sr.rep.total.InvP2TD;
            rep.total.InvP2 += sr.rep.total.InvP2;
        });
        rep.total.rate = rep.total.InvPYTD === 0 ? (rep.total.InvCYTD <= 0 ? 0 : 1) : (((rep.total.InvCYTD - rep.total.InvPYTD) / rep.total.InvPYTD));
        rep.total.pace = rep.total.InvPY === 0 ? (rep.total.InvCYTD + rep.total.OpenOrders) : ((1 + rep.total.rate) * rep.total.InvPY);

        return {userid, rep, repSubReps, repCustomers};
    } catch (err) {
        debug("loadRepTotals() error", err.message);
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


async function getRepPace(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const pace = await loadRepPace({...req.query, ...req.params, groupByCustomer: true, userid});
        res.json({pace});
    } catch (err) {
        debug("getRepPace()", err.message);
        res.json({error: err.message});
    }
}

async function getRepManagers(req, res) {
    try {
        const rep = await loadRepInfo({...req.params});
        rep.manager = await loadRepManagers({...rep});
        res.json({rep});
    } catch (err) {
        debug("getRepManagers()", err.message);
        res.json({error: err.message});
    }
}

exports.getRepPace = getRepPace;
exports.getRepManagers = getRepManagers;
exports.loadRepPace = loadRepPace;
exports.REP_TOTAL = REP_TOTAL;