const debug = require('debug')('chums:lib:rep:account-list');
const {mysql2Pool} = require('chums-local-modules');


async function loadRecentOrders({Company, SalespersonNo}) {
    try {
        const sql = `SELECT h.SalesOrderNo,
                            h.SalespersonDivisionNo,
                            h.SalespersonNo,
                            h.OrderDate,
                            h.OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.ShipToCode,
                            h.BillToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToCountryCode,
                            ih.InvoiceNo,
                            ih.InvoiceDate,
                            ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt AS InvoiceTotal,
                            h.UDF_IMPRINTED                                             AS Imprinted,
                            IF(ISNULL(b2b.id), 'N', 'Y')                                AS B2BOrder
                     FROM c2.SO_SalesOrderHistoryHeader h
                          LEFT JOIN c2.ar_invoicehistoryheader ih
                                    ON ih.Company = h.Company AND ih.SalesOrderNo = h.SalesOrderNo
                          LEFT JOIN b2b.SalesOrderLog b2b
                                    ON b2b.Company = c2.sage_company(h.Company) AND b2b.SalesOrderNo = h.SalesOrderNo
                     WHERE h.Company = :Company
                       AND h.SalespersonNo = :SalespersonNo
                       AND (h.OrderDate >= DATE_ADD(NOW(), INTERVAL -6 WEEK) OR
                            ih.InvoiceDate >= DATE_ADD(NOW(), INTERVAL -6 WEEK))
                       AND h.OrderStatus NOT IN ('X', 'Q', 'A')

                     ORDER BY h.OrderDate, h.SalesOrderNo`;
        const args = {Company, SalespersonNo};
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.InvoiceTotal = Number(row.InvoiceTotal);
        })
        return rows;
    } catch (err) {
        debug("loadRecentOrders()", err.message);
        return Promise.reject(err);
    }
}

async function loadOpenOrders({Company, SalespersonNo}) {
    try {
        const sql = `SELECT h.SalesOrderNo,
                            h.SalespersonDivisionNo,
                            h.SalespersonNo,
                            h.OrderDate,
                            h.OrderType,
                            h.OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.ShipToCode,
                            h.BillToName,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToCountryCode,
                            h.OrderTotal,
                            h.LastInvoiceNo,
                            h.ShipExpireDate,
                            h.CancelReasonCode,
                            c.CancelReasonCodeDesc,
                            h.imprinted                  AS Imprinted,
                            IF(ISNULL(b2b.id), 'N', 'Y') AS B2BOrder
                     FROM c2.SO_SalesOrderHeader h
                          LEFT JOIN c2.so_cancelreasoncode c
                                    ON c.Company = h.Company AND c.CancelReasonCode = h.CancelReasonCode
                          LEFT JOIN b2b.SalesOrderLog b2b
                                    ON b2b.Company = c2.sage_company(h.Company) AND b2b.SalesOrderNo = h.SalesOrderNo
                     WHERE h.Company = :Company
                       AND SalespersonNo = :SalespersonNo
                       AND h.OrderType NOT IN ('M')
                     ORDER BY h.OrderDate, h.SalesOrderNo`;
        const args = {Company, SalespersonNo};
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.OrderTotal = Number(row.OrderTotal);
        })
        return rows;
    } catch (err) {
        debug("loadRecentOrders()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @return {Promise<void>}
 */
async function getRepOrders(req, res) {
    try {
        const [recentOrders, openOrders] = await Promise.all([loadRecentOrders(req.params), loadOpenOrders(req.params)]);
        res.json({recentOrders, openOrders})
    } catch (err) {
        debug("getRepOrders()", err.message);
        res.json({error: err.message})
    }
}

exports.getRepOrders = getRepOrders;
exports.loadRecentOrders = loadRecentOrders;
exports.loadOpenOrders = loadOpenOrders;
