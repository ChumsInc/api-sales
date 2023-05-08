import Debug from 'debug';
import {mysql2Pool} from 'chums-local-modules';

const debug = Debug('chums:lib:safety:invoices');


/**
 *
 * @param {Object} params
 * @param {string} params.company
 * @param {string} params.SalespersonDivisionNo
 * @param {string} params.SalespersonNo
 * @param {string} params.minDate
 * @param {string} params.maxDate
 */
async function loadInvoices(params) {
    try {
        const {company, SalespersonDivisionNo, SalespersonNo, minDate, maxDate} = params;
        const query = `SELECT comm.ARDivisionNo,
                              comm.CustomerNo,
                              ih.BillToName,
                              ih.ShipToCode,
                              ih.ShipToName,
                              ih.ShipToCity as City,
                              ih.ShipToState as State,
                              ih.ShipToZipCode as ZipCode,
                              c.CustomerType,
                              comm.InvoiceNo,
                              comm.InvoiceDate,
                              comm.InvoiceTotal AS SalesTotal
                       FROM c2.ar_salespersoncommission comm
                       INNER JOIN c2.ar_invoicehistoryheader ih on ih.Company = comm.Company and ih.InvoiceNo = comm.InvoiceNo and ih.InvoiceType = comm.InvoiceType
                       INNER JOIN c2.ar_customer c on c.Company = ih.Company and c.ARDivisionNo = ih.ARDivisionNo and c.CustomerNo = ih.CustomerNo
                       WHERE comm.InvoiceDate BETWEEN {d :minDate} AND {d :maxDate}
                         AND comm.SalespersonDivisionNo = :SalespersonDivisionNo
                         AND comm.SalespersonNo = :SalespersonNo
                       AND comm.Company = :company
                       ORDER BY comm.ARDivisionNo, comm.CustomerNo, ih.ShipToCode, comm.InvoiceNo`;
        const data = {company, SalespersonDivisionNo, SalespersonNo, minDate, maxDate};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.SalesTotal = Number(row.SalesTotal);
        })
        return rows;
    } catch(err) {
        if (err instanceof Error) {
            debug("loadInvoices()", err.message);
            return Promise.reject(err);
        }
        debug("loadInvoices()", err);
        return Promise.reject(new Error('Error in loadInvoices()'));
    }
}

export const getSafetyRepInvoices = async (req, res) => {
    try {
        const invoices = await loadInvoices(req.params);
        res.json({invoices});
    } catch(err) {
        if (err instanceof Error) {
            debug("getInvoices()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getInvoices'});
    }
}
