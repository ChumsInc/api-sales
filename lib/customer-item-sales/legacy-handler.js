import { mysql2Pool } from 'chums-local-modules';
import Debug from 'debug';

const debug = Debug('chums:lib:customer-item-sales');

async function loadCustomerItemSales({ company, ARDivisionNo, CustomerNo, ItemCode, FiscalCalYear, groupShipTo, userid }) {
    try {
        const sql = `
            SELECT h.ARDivisionNo,
                   h.CustomerNo,
                   c.CustomerName,
                   IF(IFNULL(:groupShipTo, '') = '1', s.ShipToCode, '') AS ShipToCode,
                   IF(IFNULL(:groupShipTo, '') = '1', s.ShipToName, '') AS ShipToName,
                   h.ItemCode,
                   i.ItemCodeDesc,
                   h.FiscalCalYear,
                   h.FiscalCalPeriod,
                   SUM(h.QuantitySold)                                  AS QuantitySold,
                   SUM(h.DollarsSold)                                   AS DollarsSold
            FROM c2.IM_ItemCustomerHistoryByPeriod h
                     INNER JOIN c2.ar_customer c
                                ON c.ARDivisionNo = h.ARDivisionNo
                                    AND c.CustomerNo = h.CustomerNo
                                    AND c.Company = h.Company
                     INNER JOIN (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                                 FROM users.user_AR_Customer
                                 WHERE userid = :userid) ua
                                ON ua.Company = c.Company AND ua.ARDivisionNo = c.ARDivisionNo AND
                                   ua.CustomerNo = c.CustomerNo
                     INNER JOIN c2.CI_Item i
                                ON i.Company = h.Company AND i.ItemCode = h.ItemCode
                     LEFT JOIN c2.SO_ShipToAddress s
                               ON s.Company = h.Company
                                   AND s.ARDivisionNo = h.ARDivisionNo
                                   AND s.CustomerNo = h.CustomerNo
                                   AND s.ShipToCode = h.ShipToCode
            WHERE h.Company = :company
              AND (IFNULL(:ARDivisionNo, '') = '' OR h.ARDivisionNo = :ARDivisionNo)
              AND (IFNULL(:CustomerNo, '') = '' OR h.CustomerNo = :CustomerNo)
              AND (IFNULL(:ItemCode, '') = '' OR h.ItemCode REGEXP :ItemCode)
              AND h.FiscalCalYear REGEXP :FiscalCalYear
            GROUP BY ARDivisionNo, CustomerNo, h.ItemCode, IF(:groupShipTo = '1', s.ShipToCode, ''), FiscalCalYear,
                     FiscalCalPeriod
            ORDER BY ARDivisionNo, CustomerNo, ShipToCode, ItemCode, FiscalCalYear, FiscalCalPeriod`;
        const args = { company, ARDivisionNo, CustomerNo, ItemCode, FiscalCalYear, groupShipTo, userid };
        const [rows] = await mysql2Pool.query(sql, args);
        const data = {};
        const dataKey = ({ ARDivisionNo, CustomerNo, ShipToCode, ItemCode, FiscalCalYear }) => [ARDivisionNo, CustomerNo, ShipToCode, ItemCode, FiscalCalYear].join('-');
        rows.forEach(row => {
            const key = dataKey(row);
            row.DollarsSold = Number(row.DollarsSold);
            row.QuantitySold = Number(row.QuantitySold);
            const { FiscalCalPeriod, QuantitySold, DollarsSold, ...rest } = row;
            if (data[key] === undefined) {
                data[key] = { ...rest, DollarsSold: 0, QuantitySold: 0, periods: {} };
            }
            data[key].DollarsSold += DollarsSold;
            data[key].QuantitySold += QuantitySold;
            data[key].periods[FiscalCalPeriod] = { QuantitySold, DollarsSold };
        });
        return Object.keys(data).map(key => data[key]);
    }
    catch (err) {
        debug("loadCustomerItemSales()", err.message);
        return err;
    }
}

export async function getCustomerItemSales(req, res) {
    try {
        const userid = res.locals.profile?.user?.id || 0;
        const params = { ...req.query, ...req.params, userid };
        const data = await loadCustomerItemSales(params);
        res.json({ result: data });
    }
    catch (err) {
        debug("getCustomerItemSales()", err.message);
        res.json({ error: err.message });
    }
}
