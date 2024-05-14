import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
import dayjs from "dayjs";
const debug = Debug('chums:lib:audits:customer:ship-to-rep');
function sageDateToString(arg) {
    const date = dayjs(arg.date, 'America/Denver');
    if (!date.isValid()) {
        return null;
    }
    return date.add(+arg.time, 'hours')
        .subtract(date.toDate().getTimezoneOffset(), 'seconds')
        .toISOString();
}
async function loadShipToAudit(options) {
    try {
        const sql = `SELECT JSON_OBJECT(
                                    'ARDivisionNo', c.ARDivisionNo,
                                    'CustomerNo', c.CustomerNo,
                                    'CustomerName', c.CustomerName,
                                    'Salesperson', JSON_OBJECT(
                                            'SalespersonDivisionNo', br.SalespersonDivisionNo,
                                            'SalespersonNo', br.SalespersonNo,
                                            'SalespersonName', br.SalespersonName
                                                   ),
                                    'updated', JSON_OBJECT(
                                            'date', c.DateUpdated,
                                            'time', c.TimeUpdated
                                               )
                            ) AS Customer,
                            JSON_OBJECT(
                                    'ShipToCode', s.ShipToCode,
                                    'ShipToName', s.ShipToName,
                                    'Salesperson', JSON_OBJECT(
                                            'SalespersonDivisionNo', sr.SalespersonDivisionNo,
                                            'SalespersonNo', sr.SalespersonNo,
                                            'SalespersonName', sr.SalespersonName
                                                   ),
                                    'updated', JSON_OBJECT(
                                            'date', s.DateUpdated,
                                            'time', s.TimeUpdated
                                               )
                            ) AS ShipToAddress
                     FROM c2.ar_customer c
                              LEFT JOIN c2.SO_ShipToAddress s USING (Company, ARDivisionNo, CustomerNo)
                              LEFT JOIN c2.ar_salesperson br
                                        ON br.Company = c.Company AND
                                           br.SalespersonDivisionNo = c.SalespersonDivisionNo AND
                                           br.SalespersonNo = c.SalespersonNo
                              LEFT JOIN c2.ar_salesperson sr
                                        ON sr.Company = s.Company AND
                                           sr.SalespersonDivisionNo = s.SalespersonDivisionNo AND
                                           sr.SalespersonNo = s.SalespersonNo
                     WHERE NOT (sr.SalespersonDivisionNo = br.SalespersonDivisionNo AND
                                sr.SalespersonNo = br.SalespersonNo)
                       AND NOT (sr.SalesManagerDivisionNo = br.SalespersonDivisionNo AND
                                sr.SalesManagerNo = br.SalespersonNo)
                       AND IF(:excludeUnassigned, c.SalespersonNo <> '0000', 1)
                       AND IF(:excludeHouse, c.SalespersonNo NOT IN ('H00', 'H00E', 'H00W', 'H04', 'R00'), 1)
                       AND NOT (c.ARDivisionNo = '01' AND c.CustomerNo = 'TEST')
                       AND c.CustomerStatus = 'A'`;
        const params = {
            excludeUnassigned: options.excludeUnassigned ? 1 : 0,
            excludeHouse: options.excludeHouse ? 1 : 0,
        };
        const [rows] = await mysql2Pool.query(sql, params);
        return rows.map(row => {
            const customer = JSON.parse(row.Customer);
            const shipToAddress = JSON.parse(row.ShipToAddress);
            return {
                ...customer,
                updated: sageDateToString(customer.updated),
                ShipToAddress: {
                    ...shipToAddress,
                    updated: sageDateToString(shipToAddress.updated)
                }
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadShipToAudit()", err.message);
            return Promise.reject(err);
        }
        debug("loadShipToAudit()", err);
        return Promise.reject(new Error('Error in loadShipToAudit()'));
    }
}
export const getCustomerShipToAudit = async (req, res) => {
    try {
        const options = {
            excludeUnassigned: req.query.excludeUnassigned === '1',
            excludeHouse: req.query.excludeHouse === '1',
        };
        debug('renderCustomerShipToAudit()', options);
        const rows = await loadShipToAudit(options);
        res.json(rows);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCustomerShipToAudit()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getCustomerShipToAudit' });
    }
};
export const renderCustomerShipToAudit = async (req, res) => {
    try {
        debug('renderCustomerShipToAudit()', req.query);
        const options = {
            excludeUnassigned: req.query.excludeUnassigned === '1',
            excludeHouse: req.query.excludeHouse === '1',
        };
        const rows = await loadShipToAudit(options);
        return res.render('audits/customer/ship-to-rep.pug', { rows });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderCustomerShipToAudit()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in renderCustomerShipToAudit' });
    }
};
