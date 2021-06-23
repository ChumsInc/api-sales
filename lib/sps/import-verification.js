const debug = require('debug')('chums:lib:sps:import-verification');
const {mysql2Pool} = require('chums-local-modules');
const {handleUpload, parseFile} = require('./csv-utils');

async function loadOrders({company, poList}) {
    try {
        const sql = `SELECT h.CustomerPONo,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.BillToName,
                            GROUP_CONCAT(DISTINCT SalesOrderNo)                 AS SalesOrders,
                            GROUP_CONCAT(
                                    (
                                    SELECT DISTINCT InvoiceNo
                                    FROM c2.ar_invoicehistoryheader
                                    WHERE Company = h.Company
                                      AND SalesOrderNo = h.SalesOrderNo
                                      AND InvoiceType <> 'XD'
                                    )
                                )                                               AS Invoices,
                            SUM(h.NonTaxableAmt + h.TaxableAmt - h.DiscountAmt) AS OrderTotal
                     FROM c2.SO_SalesOrderHistoryHeader h
                     WHERE h.Company = :company
                       AND h.CustomerPONo IN (:poList)
                       AND h.OrderStatus NOT IN ('Q', 'X', 'Z', 'M')
                     GROUP BY h.CustomerPONo, h.ARDivisionNo, h.CustomerNo, h.BillToName`;
        const [rows] = await mysql2Pool.query(sql, {company, poList});
        rows.forEach(row => {
            row.SalesOrders = (row.SalesOrders ?? '').split(',').filter(value => !!value);
            row.Invoices = (row.Invoices ?? '').split(',').filter(value => !!value);
            row.OrderTotal = Number(row.OrderTotal)
        })
        return rows;
    } catch (err) {
        debug("loadOrders()", err.message);
        return Promise.reject(err);
    }
}


function trimExcelFormulae(csv = []) {
    return csv.map(row => {
        const values = {...row};
        Object.keys(values).forEach(key => {
            const value = values[key];

            if (typeof value === 'string') {
                values[key] = value.replace(/^"=""/, '').replace(/"""$/, '') || '';
            }
        });
        return {...values};
    })
}

async function getOrderVerification(req, res) {
    try {
        const file = await handleUpload(req);
        const parsed = await parseFile(file.path);
        const trimmed = trimExcelFormulae(parsed);
        const poList = trimmed.filter(row => row['Delivery Method'] === 'WEB').map(row => row['Document ID']);
        const existingOrders = await loadOrders({company: 'chums', poList});
        const orders = trimmed
            .filter(row => row['Delivery Method'] === 'WEB')
            .map(row => {
            const [so = {}] = existingOrders.filter(so => so.CustomerPONo === row['Document ID']);
            return {...row, SalesOrders: [], Invoices: [], ...so};
        })
        res.json({orders});
    } catch (err) {
        debug("getOrders()", err.message);
        res.json({error: err.message});
    }
}

exports.getOrderVerification = getOrderVerification;
