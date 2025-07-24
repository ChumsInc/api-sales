import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
import dayjs from "dayjs";
import numeral from "numeral";
const debug = Debug('chums:lib:vbg-month-sales');
let tableHeaders = [
    'Sales Order No',
    'AR Division No',
    'Customer No',
    'Customer Name',
    'Invoice No',
    'Invoice Date',
    'Sales Total',
    'Freight',
    'Tax Schedule',
    'Sales Tax Amount',
    'Total',
    'Terms Code Desc'
];
export const queryVBGMonthlySales = async (year, month) => {
    try {
        const sql = `
            select ihh.SalesOrderNo,
                   ihh.ARDivisionNo,
                   ihh.CustomerNo,
                   ihh.BillToName                                                                  as customerName,
                   ihh.InvoiceNo,
                   ihh.InvoiceDate,
                   ihh.TaxableSalesAmt + ihh.NonTaxableSalesAmt                                    as salesTotal,
                   ihh.FreightAmt                                                                  as freight,
                   ihh.TaxSchedule,
                   ihh.SalesTaxAmt,
                   ihh.TaxableSalesAmt + ihh.NonTaxableSalesAmt + ihh.SalesTaxAmt + ihh.FreightAmt as total,
                   ifnull(tc.TermsCodeDesc, '') as TermsCodeDesc
            from c2.ar_invoicehistoryheader ihh
                     left join c2.ar_termscode tc on ihh.company = tc.company and ihh.TermsCode = tc.TermsCode
            # where ihh.InvoiceDate like '2025-03%'
            where year(ihh.InvoiceDate) = :year
              and month(ihh.InvoiceDate) = :month
              and ihh.InvoiceType <> 'XD'
              and ihh.CustomerNo = 'NJ0001'
            order by ihh.InvoiceNo;
        `;
        const [rows] = await mysql2Pool.query(sql, { year, month });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("queryVBGMonthlySales()", err.message);
            return Promise.reject(err);
        }
        debug("queryVBGMonthlySales()", err);
        return Promise.reject(new Error('Error in queryVBGMonthlySales()'));
    }
};
const renderCSV = (invoices) => {
    let csv = tableHeaders.join(',') + '\n';
    csv += invoices.map(inv => {
        return [
            inv.SalesOrderNo,
            inv.ARDivisionNo,
            inv.CustomerNo,
            inv.customerName,
            inv.InvoiceNo,
            dayjs(inv.InvoiceDate).format('YYYY-MM-DD'),
            numeral(inv.salesTotal).format('0.00'),
            numeral(inv.freight).format('0.00'),
            inv.TaxSchedule,
            numeral(inv.SalesTaxAmt).format('0.00'),
            numeral(inv.total).format('0.00'),
            inv.TermsCodeDesc
        ].join(',');
    }).join('\n');
    return csv;
};
export const downloadVBGMonthlyInvoices = async (req, res) => {
    const date = dayjs().subtract(1, 'month');
    const year = req.query.year ?? date.format('YYYY');
    const month = req.query.month ?? date.format('MM');
    const invoices = await queryVBGMonthlySales(year, month);
    if (!invoices || !invoices.length) {
        res.status(301).send();
        return;
    }
    const csv = renderCSV(invoices);
    const _renderedInvoices = invoices.map(inv => ({
        ...inv,
        InvoiceDate: dayjs(inv.InvoiceDate).format('YYYY-MM-DD')
    }));
    res.contentType('text/csv').send(csv);
    // return csv;
};
export const renderVBGMonthlyInvoices = async (req, res) => {
    try {
        const date = dayjs().subtract(1, 'month');
        const year = req.query.year ?? date.format('YYYY');
        const month = req.query.month ?? date.format('MM');
        const invoices = await queryVBGMonthlySales(year, month);
        if (!invoices || !invoices.length) {
            res.status(301).send();
            return;
        }
        const csv = renderCSV(invoices);
        const _renderedInvoices = invoices.map(inv => ({
            ...inv,
            InvoiceDate: dayjs(inv.InvoiceDate).format('YYYY-MM-DD')
        }));
        const html = await new Promise((resolve, reject) => {
            res.render('sales/vbg-monthly-sales.pug', { invoices: _renderedInvoices }, (err, html) => {
                if (err) {
                    reject(err);
                }
                return resolve(html);
            });
        });
        res.send(html);
        return;
        const attachments = [{
                filename: 'invoices.json',
                contentType: 'text/csv; name=invoices.csv',
                encoding: 'base64',
                contentDisposition: 'attachment',
                content: Buffer.from(csv).toString('base64')
            }];
        res.json({
            html,
            attachments,
        });
        // res.contentType('text/csv').send(csv);
        // return csv;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderVBGMonthlyInvoices()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in renderVBGMonthlyInvoices' });
    }
};
