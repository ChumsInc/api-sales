import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';

const debug = Debug('chums:lib:sales-map');

async function loadSalesByBillToState({year}) {
    try {
        const d = new Date();
        const minDate = new Date(year, 0, 1);
        const maxDate = new Date(year, 11, 31);
        const query = `SELECT s.StateCode,
                              s.StateName,
                              (SELECT SUM(SalesTaxAmt + NonTaxableSalesAmt - DiscountAmt)
                               FROM c2.ar_invoicehistoryheader h
                               WHERE h.Company = 'chums'
                                 AND h.BillToState = s.StateCode
                                 AND h.BillToCountryCode = s.CountryCode
                                 AND h.InvoiceDate BETWEEN :minDate AND :maxDate) AS salesTotal
                       FROM c2.SY_State s
                       WHERE s.CountryCode IN ('US', 'USA')
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

async function loadSalesByShipToState({year}) {
    try {
        const minDate = new Date(year, 0, 1);
        const maxDate = new Date(year, 11, 31);
        const query = `SELECT s.StateCode,
                              s.StateName,
                              (SELECT SUM(SalesTaxAmt + NonTaxableSalesAmt - DiscountAmt)
                               FROM c2.ar_invoicehistoryheader h
                               WHERE h.Company = 'chums'
                                 AND h.ShipToState = s.StateCode and h.ShipToCountryCode = s.CountryCode
                                 AND h.InvoiceDate between :minDate and :maxDate) AS salesTotal
                       FROM c2.SY_State s
                       WHERE s.CountryCode IN ('US', 'USA')
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

export async function getSalesByBillToState(req, res) {
    try {
        const sales = await loadSalesByBillToState(req.params);
        res.json({sales});
    } catch (err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
}



export async function getSalesByShipToState(req, res) {
    try {
        const sales = await loadSalesByShipToState(req.params);
        res.json({sales});
    } catch (err) {
        debug("get()", err.message);
        res.json({error: err.message});
    }
}

