import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';

const debug = Debug('chums:lib:sales-map');

async function loadSalesByBillToState({year}) {
    try {
        const d = new Date();
        const minDate = new Date(year, 0, 1);
        const maxDate = new Date(year, 11, 31);
        const query = `WITH SalesByState
                                AS (SELECT COALESCE(h.BillToCountryCode, c.CountryCode, 'USA')     AS CountryCode,
                                           COALESCE(h.BillToState, c.State)                        AS State,
                                           SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS salesTotal
                                    FROM c2.ar_invoicehistoryheader h
                                             INNER JOIN c2.ar_customer c
                                                        ON c.Company = h.Company AND c.ARDivisionNo = h.ARDivisionNo AND
                                                           c.CustomerNo = h.CustomerNo
                                    WHERE h.InvoiceDate >= :minDate
                                      AND h.InvoiceDate <= :maxDate
                                    GROUP BY COALESCE(h.BillToCountryCode, c.CountryCode, 'USA'),
                                             COALESCE(h.BillToState, c.State))
                       SELECT s.StateCode,
                              s.StateName,
                              ss.salesTotal
                       FROM c2.SY_State s 
                           LEFT JOIN SalesByState ss on s.CountryCode = ss.CountryCode AND s.StateCode = ss.State
                       WHERE s.CountryCode = 'USA'`
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
        const query = `WITH SalesByState
                                AS (SELECT COALESCE(h.ShipToCountryCode, c.CountryCode, 'USA')     AS CountryCode,
                                           COALESCE(h.ShipToState, c.State)                        AS StateCode,
                                           SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS salesTotal
                                    FROM c2.ar_invoicehistoryheader h
                                             INNER JOIN c2.ar_customer c
                                                        ON c.Company = h.Company AND c.ARDivisionNo = h.ARDivisionNo AND
                                                           c.CustomerNo = h.CustomerNo
                                    WHERE h.InvoiceDate >= :minDate
                                      AND h.InvoiceDate <= :maxDate
                                    GROUP BY COALESCE(h.ShipToCountryCode, c.CountryCode, 'USA'),
                                             COALESCE(h.ShipToState, c.State))
                       SELECT s.StateCode,
                              s.StateName,
                              ss.salesTotal
                       FROM c2.SY_State s
                                LEFT JOIN SalesByState ss
                                          ON s.CountryCode = ss.CountryCode AND s.StateCode = ss.StateCode
                       WHERE s.CountryCode = 'USA'`
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

