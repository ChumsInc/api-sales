import {mysql2Pool} from 'chums-local-modules';
import Debug from 'debug';
import dayjs from "dayjs";
import numeral from 'numeral';

const debug = Debug('chums:lib:rep:terminated-rep-reports');

async function checkCustomers() {
    try {
        const sql = `SELECT CONCAT(ARDivisionNo, '-', CustomerNo) AS CustomerNo,
                            CustomerName,
                            CONCAT(ARDivisionNo, '-', CustomerNo) AS CustomerNo,
                            s.SalespersonName
                     FROM c2.ar_customer c
                              INNER JOIN c2.ar_salesperson s
                                         USING (Company, SalespersonDivisionNo, SalespersonNo)
                     WHERE c.CustomerStatus = 'A'
                       AND s.UDF_TERMINATED = 'Y'`
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("checkCustomers()", err.message);
            return Promise.reject(err);
        }
        debug("checkCustomers()", err);
        return Promise.reject(new Error('Error in checkCustomers()'));
    }
}

async function checkShipToAddresses() {
    try {
        const sql = `SELECT CONCAT(c.ARDivisionNo, '-', c.CustomerNo)               AS CustomerNo,
                            c.CustomerName,
                            st.ShipToCode,
                            st.ShipToName,
                            CONCAT(st.SalespersonDivisionNo, '-', st.SalespersonNo) AS SalespersonNo,
                            s.SalespersonName
                     FROM c2.ar_customer c
                              INNER JOIN c2.SO_ShipToAddress st
                                         ON st.Company = c.Company AND st.ARDivisionNo = c.ARDivisionNo AND
                                            st.CustomerNo = c.CustomerNo
                              INNER JOIN c2.ar_salesperson s
                                         ON s.Company = st.Company AND
                                            s.SalespersonDivisionNo = st.SalespersonDivisionNo AND
                                            s.SalespersonNo = st.SalespersonNo
                     WHERE c.CustomerStatus = 'A'
                       AND s.UDF_TERMINATED = 'Y'`
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("checkShipToAddresses()", err.message);
            return Promise.reject(err);
        }
        debug("checkShipToAddresses()", err);
        return Promise.reject(new Error('Error in checkShipToAddresses()'));
    }
}

async function checkSalesOrders() {
    try {
        const sql = `SELECT so.SalesOrderNo,
                            CONCAT(so.ARDivisionNo, '-', so.CustomerNo)           AS CustomerNo,
                            so.BillToName,
                            so.OrderType,
                            so.OrderTotal,
                            so.ShipExpireDate,
                            CONCAT(s.SalespersonDivisionNo, '-', s.SalespersonNo) AS SalespersonNo,
                            s.SalespersonName
                     FROM c2.SO_SalesOrderHeader so
                              INNER JOIN c2.ar_salesperson s
                                         ON s.Company = so.Company AND
                                            s.SalespersonDivisionNo = so.SalespersonDivisionNo AND
                                            s.SalespersonNo = so.SalespersonNo
                     WHERE so.OrderType <> 'Q'
                       AND s.UDF_TERMINATED = 'Y'`
        const [rows] = await mysql2Pool.query(sql);
        return rows.map(row => {
            return {
                ...row,
                ShipExpireDate: dayjs(row.ShipExpireDate).format('MM/DD/YYYY'),
                OrderTotal: numeral(row.OrderTotal).format('$0,0.00')
            }
        });
    } catch (err) {
        if (err instanceof Error) {
            debug("checkSalesOrders()", err.message);
            return Promise.reject(err);
        }
        debug("checkSalesOrders()", err);
        return Promise.reject(new Error('Error in checkSalesOrders()'));
    }
}

async function checkInvoices({minDate, maxDate}) {
    try {
        if (!minDate) {
            minDate = dayjs().startOf('month').format('YYYY-MM-DD');
        }
        if (!maxDate) {
            maxDate = dayjs().endOf('month').format('YYYY-MM-DD');
        }
        const sql = `SELECT ih.InvoiceType,
                            ih.InvoiceNo,
                            ih.HeaderSeqNo,
                            ih.SalesOrderNo,
                            CONCAT(ih.ARDivisionNo, '-', ih.CustomerNo)                 AS CustomerNo,
                            ih.BillToName,
                            ih.InvoiceDate,
                            ih.TaxableSalesAmt + ih.NonTaxableSalesAmt - ih.DiscountAmt AS InvoiceAmt,
                            sc.CommissionAmt,
                            CONCAT(s.SalespersonDivisionNo, '-', s.SalespersonNo)       AS SalespersonNo,
                            s.SalespersonName
                     FROM c2.ar_invoicehistoryheader ih
                              INNER JOIN c2.ar_salespersoncommission sc
                                        on sc.Company = ih.Company and
                                           sc.InvoiceNo = ih.InvoiceNo
                              INNER JOIN c2.ar_salesperson s
                                        on s.Company = ih.Company and
                                           s.SalespersonDivisionNo = ifnull(sc.SalespersonDivisionNo, ih.SalespersonDivisionNo) and
                                           s.SalespersonNo = ifnull(sc.SalespersonNo, ih.SalespersonNo)
                     WHERE ih.Company = 'chums'
                       AND ih.InvoiceType <> 'XD'
                       AND ih.invoiceDate BETWEEN :minDate AND :maxDate
                       AND s.UDF_TERMINATED = 'Y'
                     ORDER BY ih.Company, ih.InvoiceNo, ih.HeaderSeqNo `;
        const args = {minDate, maxDate};
        debug('checkInvoices()', args);
        const [rows] = await mysql2Pool.query(sql, args);
        debug('checkInvoices()', rows.length);
        return rows.map(row => {
            return {
                ...row,
                InvoiceDate: dayjs(row.InvoiceDate).format('MM/DD/YYYY'),
                InvoiceAmt: numeral(row.InvoiceAmt).format('$0,0.00'),
                CommissionAmt: numeral(row.CommissionAmt).format('$0,0.00'),
            }
        });
    } catch (err) {
        if (err instanceof Error) {
            debug("checkInvoices()", err.message);
            return Promise.reject(err);
        }
        debug("checkInvoices()", err);
        return Promise.reject(new Error('Error in checkInvoices()'));
    }
}

export const getTerminatedRepAccounts = async (req, res) => {
    try {
        const customers = await checkCustomers();
        const shipToAddresses = await checkShipToAddresses();
        res.json({customers, shipToAddresses})
    } catch (err) {
        if (err instanceof Error) {
            debug("getTerminatedRepAccounts()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getTerminatedRepAccounts'});
    }
}

export const getTerminatedRepOpenOrders = async (req, res) => {
    try {
        const orders = await checkSalesOrders();
        res.json({orders});
    } catch (err) {
        if (err instanceof Error) {
            debug("getTerminatedRepOpenOrders()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getTerminatedRepOpenOrders'});
    }
}

export const getTerminatedRepInvoices = async (req, res) => {
    try {
        const invoices = await checkInvoices(req.params);
        res.json({invoices});
    } catch (err) {
        if (err instanceof Error) {
            debug("getTerminatedRepInvoices()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getTerminatedRepInvoices'});
    }
}

export const renderTerminatedRepOrdersReport = async (req, res) => {
    try {
        const orders = await checkSalesOrders(req.params);
        if (!orders || !orders.length) {
            res.status(301).send();
            return;
        }
        return res.render('sales/terminated-rep-orders.pug', {orders})
    } catch (err) {
        if (err instanceof Error) {
            debug("renderTerminatedRepOrdersReport()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in renderTerminatedRepOrdersReport'});
    }
}

export const renderTerminatedRepInvoiceReport = async (req, res) => {
    try {
        const invoices = await checkInvoices(req.params);
        if (!invoices || !invoices.length) {
            res.status(301).send();
            return;
        }
        return res.render('sales/terminated-rep-invoices.pug', {invoices})
    } catch (err) {
        if (err instanceof Error) {
            debug("renderTerminatedRepInvoiceReport()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in renderTerminatedRepInvoiceReport'});
    }
}
