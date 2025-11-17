import { mysql2Pool } from 'chums-local-modules';
import Debug from "debug";
const debug = Debug('chums:lib:gdpr');
async function loadSalesOrder(SalesOrderNo) {
    try {
        debug('loadSalesOrder()', { SalesOrderNo });
        const sqlSO = `SELECT SalesOrderNo, BillToName, BillToAddress1, ShipToName, ShipToAddress1, EmailAddress
                       FROM c2.SO_SalesOrderHistoryHeader
                       WHERE company = 'chums'
                         AND SalesOrderNo = :SalesOrderNo`;
        const sqlInv = `SELECT InvoiceNo, BillToName, BillToAddress1, ShipToName, ShipToAddress1, EmailAddress
                        FROM c2.ar_invoicehistoryheader
                        WHERE company = 'chums'
                          AND SalesOrderNo = :SalesOrderNo`;
        const [orders] = await mysql2Pool.query(sqlSO, { SalesOrderNo });
        const [invoices] = await mysql2Pool.query(sqlInv, { SalesOrderNo });
        return { orders, invoices };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadSalesOrder()", err.message);
            return Promise.reject(err);
        }
        debug("loadSalesOrder()", err);
        return Promise.reject(new Error('Error in loadSalesOrder()'));
    }
}
async function gdprSalesOrder(SalesOrderNo) {
    try {
        const sqlSOHistoryHeader = `
            UPDATE c2.SO_SalesOrderHistoryHeader
            SET BillToName     = 'REMOVED PII',
                BillToAddress1 = '---',
                BillToZipCode  = LEFT(BillToZipCode, 6),
                ShipToName     = 'REMOVED PII',
                ShipToAddress1 = '---',
                ShipToZipCode  = LEFT(BillToZipCode, 6),
                EmailAddress   = ''
            WHERE Company = 'chums'
              AND SalesOrderNo = :SalesOrderNo`;
        const sqlARInvHistoryHeader = `
            UPDATE c2.ar_invoicehistoryheader
            SET BillToName     = 'REMOVED PII',
                BillToAddress1 = '---',
                BillToZipCode  = LEFT(BillToZipCode, 6),
                ShipToName     = 'REMOVED PII',
                ShipToAddress1 = '---',
                ShipToZipCode  = LEFT(BillToZipCode, 6),
                EmailAddress   = ''
            WHERE Company = 'chums'
              AND SalesOrderNo = :SalesOrderNo`;
        //# Shopify Fulfillment log, these can be deleted.
        const sqlShopifyFulfillment = `
            DELETE shopify.fulfillment
            FROM shopify.fulfillment
                     INNER JOIN shopify.orders
                                ON fulfillment.order_id = orders.id
            WHERE orders.sage_Company = 'chums'
              AND orders.sage_SalesOrderNo = :SalesOrderNo`;
        // # Shopify Import log, these can be deleted.
        const sqlShopifyOrders = `
            DELETE
            FROM shopify.orders
            WHERE sage_Company = 'chums'
              AND sage_SalesOrderNo = :SalesOrderNo
              AND id <> 0`;
        const args = { SalesOrderNo };
        const [rSOH] = await mysql2Pool.query(sqlSOHistoryHeader, args);
        const [rARH] = await mysql2Pool.query(sqlARInvHistoryHeader, args);
        const [rShFF] = await mysql2Pool.query(sqlShopifyFulfillment, args);
        const [rShOH] = await mysql2Pool.query(sqlShopifyOrders, args);
        return { args, rSOH, rARH, rShFF, rShOH };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("gdprSalesOrder()", err.message);
            return Promise.reject(err);
        }
        debug("gdprSalesOrder()", err);
        return Promise.reject(new Error('Error in gdprSalesOrder()'));
    }
}
async function performGDPRRequest(email) {
    try {
        const sqlSalesOrders = `
            SELECT SalesOrderNo
            FROM c2.SO_SalesOrderHistoryHeader
            WHERE Company = 'chums'
              AND EMailAddress = :email`;
        const [rows] = await mysql2Pool.query(sqlSalesOrders, { email });
        return await Promise.all(rows.map(row => gdprSalesOrder(row.SalesOrderNo)));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("performGDPRRequest()", err.message);
            return Promise.reject(err);
        }
        debug("performGDPRRequest()", err);
        return Promise.reject(new Error('Error in performGDPRRequest()'));
    }
}
export async function execGDPRRequest(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.json({ error: 'email address is required' });
        }
        const result = await performGDPRRequest(email);
        res.json({ result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("execGDPRRequest()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in execGDPRRequest' });
    }
}
export async function getGDPRSORequest(req, res) {
    try {
        const { orders, invoices } = await loadSalesOrder(req.params.SalesOrderNo);
        res.json({ orders, invoices });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getGDPRSORequest()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getGDPRSORequest' });
    }
}
export async function execGDPRSORequest(req, res) {
    try {
        const result = await gdprSalesOrder(req.params.SalesOrderNo);
        res.json({ result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("execGDPRSORequest()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in execGDPRSORequest' });
    }
}
