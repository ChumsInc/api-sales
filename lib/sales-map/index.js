const debug = require('debug')('chums:lib:sales-map');
const {mysql2Pool} = require('chums-local-modules');

async function loadSales({year}) {
    try {
        const d = new Date();
        const minDate = new Date(year, 0, 1);
        const maxDate = new Date(year, 11, 31);
        const query = `SELECT s.StateCode, s.StateName , SUM(h.SalesTaxAmt + h.NonTaxableSalesAmt - h.DiscountAmt) AS salesTotal
                       FROM c2.ar_invoicehistoryheader h
                            INNER JOIN c2.SY_State s
                                       ON s.StateCode = h.BillToState AND s.CountryCode = h.BillToCountryCode
                       WHERE Company = 'chums'
                         AND InvoiceDate BETWEEN :minDate AND :maxDate
                         AND BillToCountryCode IN ('US', 'USA')
                       GROUP BY s.StateCode, s.StateName, s.StateName`
        const data = {minDate, maxDate};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.salesTotal = Number(row.salesTotal);
        });
        return rows;
    } catch (err) {
        debug("loadSales()", err.message);
        return Promise.reject(err);
    }
}

async function get(req, res) {
    try {
        const sales = await loadSales(req.params);
        res.json({sales});
    } catch (err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
}

exports.get = get;
