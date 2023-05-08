import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";

const debug = Debug('chums:lib:gdpr');

async function loadSalesOrder({Company, SalesOrderNo}) {
    try {
        debug('loadSalesOrder()', {Company, SalesOrderNo});
        const sqlSO = `SELECT SalesOrderNo, BillToName, BillToAddress1, ShipToName, ShipToAddress1, EmailAddress
                       FROM c2.SO_SalesOrderHistoryHeader
                       WHERE company = :Company
                         AND SalesOrderNo = :SalesOrderNo`
        const sqlInv = `SELECT InvoiceNo, BillToName, BillToAddress1, ShipToName, ShipToAddress1, EmailAddress
                        FROM c2.ar_invoicehistoryheader
                        WHERE company = :Company
                          AND SalesOrderNo = :SalesOrderNo`

        const [orders] = await mysql2Pool.query(sqlSO, {Company, SalesOrderNo});
        const [invoices] = await mysql2Pool.query(sqlInv, {Company, SalesOrderNo});
        return {orders, invoices};
    } catch (err) {
        debug("loadSalesOrder()", err.message);
        return Promise.reject(err);
    }
}

async function gdprSalesOrder({Company, SalesOrderNo}) {
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
            WHERE Company = :Company
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
            WHERE Company = :Company
              AND SalesOrderNo = :SalesOrderNo`;

        //# Shopify Fulfillment log, these can be deleted.
        const sqlShopifyFulfillment = `
            DELETE shopify.fulfillment
            FROM shopify.fulfillment
                     INNER JOIN shopify.orders
                                ON fulfillment.order_id = orders.id
            WHERE orders.sage_Company = :Company
              AND orders.sage_SalesOrderNo = :SalesOrderNo`;

        // # Shopify Import log, these can be deleted.
        const sqlShopifyOrders = `
            DELETE
            FROM shopify.orders
            WHERE sage_Company = :Company
              AND sage_SalesOrderNo = :SalesOrderNo
              AND id <> 0`

        const args = {Company, SalesOrderNo};

        const [rSOH] = await mysql2Pool.query(sqlSOHistoryHeader, args);
        const [rARH] = await mysql2Pool.query(sqlARInvHistoryHeader, args);
        const [rShFF] = await mysql2Pool.query(sqlShopifyFulfillment, args);
        const [rShOH] = await mysql2Pool.query(sqlShopifyOrders, args);

        return {args, rSOH, rARH, rShFF, rShOH}
    } catch (err) {
        debug("gdprSalesOrder()", err.message);
        return Promise.reject(err);
    }
}

async function performGDPRRequest({company, email}) {
    try {
        const sqlSalesOrders = `
            SELECT Company, SalesOrderNo
            FROM c2.SO_SalesOrderHistoryHeader
            WHERE Company = :company
              AND EMailAddress = :email`;
        const [rows] = await mysql2Pool.query(sqlSalesOrders, {company, email});
        return await Promise.all(rows.map(row => gdprSalesOrder(row)));
    } catch (err) {
        debug("performGDPRRequest()", err.message);
        return Promise.reject(err);
    }
}

export async function execGDPRRequest(req, res) {
    try {
        const {email} = req.body;
        const {company} = req.params;
        if (!email) {
            return res.json({error: 'email address is required'});
        }
        const result = await performGDPRRequest({company, email});
        res.json({result});
    } catch (err) {
        debug("execRequest()", err.message);
        res.json({error: err.message});
    }
}

export async function getGDPRSORequest(req, res) {
    try {
        const {orders, invoices} = await loadSalesOrder(req.params);
        res.json({orders, invoices});
    } catch (err) {
        debug("getGDPRSORequest()", err.message);
        return Promise.reject(err);
    }
}

export async function execGDPRSORequest(req, res) {
    try {
        const {Company, SalesOrderNo} = req.params;
        const result = await gdprSalesOrder({Company, SalesOrderNo});
        res.json({result});
    } catch (err) {
        debug("execGDPRSalesOrderRequest()", err.message);
        return Promise.reject(err);
    }
}

