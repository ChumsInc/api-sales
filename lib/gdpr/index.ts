import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
import {Request, Response} from "express";
import {ResultSetHeader, RowDataPacket} from "mysql2";

const debug = Debug('chums:lib:gdpr');

async function loadSalesOrder(SalesOrderNo:string):Promise<LoadOrdersResponse> {
    try {
        debug('loadSalesOrder()', {SalesOrderNo});
        const sqlSO = `SELECT SalesOrderNo, BillToName, BillToAddress1, ShipToName, ShipToAddress1, EmailAddress
                       FROM c2.SO_SalesOrderHistoryHeader
                       WHERE company = 'chums'
                         AND SalesOrderNo = :SalesOrderNo`
        const sqlInv = `SELECT InvoiceNo, BillToName, BillToAddress1, ShipToName, ShipToAddress1, EmailAddress
                        FROM c2.ar_invoicehistoryheader
                        WHERE company = 'chums'
                          AND SalesOrderNo = :SalesOrderNo`

        const [orders] = await mysql2Pool.query<SOHistoryRow[]>(sqlSO, {SalesOrderNo});
        const [invoices] = await mysql2Pool.query<ARInvHistoryRow[]>(sqlInv, {SalesOrderNo});
        return {orders, invoices};
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadSalesOrder()", err.message);
            return Promise.reject(err);
        }
        debug("loadSalesOrder()", err);
        return Promise.reject(new Error('Error in loadSalesOrder()'));
    }
}

async function gdprSalesOrder(SalesOrderNo:string):Promise<GDPRSalesOrderResult> {
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
              AND id <> 0`

        const args = {SalesOrderNo};

        const [rSOH] = await mysql2Pool.query<ResultSetHeader>(sqlSOHistoryHeader, args);
        const [rARH] = await mysql2Pool.query<ResultSetHeader>(sqlARInvHistoryHeader, args);
        const [rShFF] = await mysql2Pool.query<ResultSetHeader>(sqlShopifyFulfillment, args);
        const [rShOH] = await mysql2Pool.query<ResultSetHeader>(sqlShopifyOrders, args);

        return {args, rSOH, rARH, rShFF, rShOH}
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("gdprSalesOrder()", err.message);
            return Promise.reject(err);
        }
        debug("gdprSalesOrder()", err);
        return Promise.reject(new Error('Error in gdprSalesOrder()'));
    }
}


async function performGDPRRequest(email:string):Promise<GDPRSalesOrderResult[]> {
    try {
        const sqlSalesOrders = `
            SELECT SalesOrderNo
            FROM c2.SO_SalesOrderHistoryHeader
            WHERE Company = 'chums'
              AND EMailAddress = :email`;
        const [rows] = await mysql2Pool.query<SalesOrderHistoryRow[]>(sqlSalesOrders, {email});
        return await Promise.all(rows.map(row => gdprSalesOrder(row.SalesOrderNo)));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("performGDPRRequest()", err.message);
            return Promise.reject(err);
        }
        debug("performGDPRRequest()", err);
        return Promise.reject(new Error('Error in performGDPRRequest()'));
    }
}

export async function execGDPRRequest(req:Request, res:Response) {
    try {
        const {email} = req.body;
        if (!email) {
            return res.json({error: 'email address is required'});
        }
        const result = await performGDPRRequest(email);
        res.json({result});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("execGDPRRequest()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in execGDPRRequest'});
    }
}

export async function getGDPRSORequest(req:Request, res:Response) {
    try {
        const {orders, invoices} = await loadSalesOrder(req.params.SalesOrderNo);
        res.json({orders, invoices});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getGDPRSORequest()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getGDPRSORequest'});
    }
}

export async function execGDPRSORequest(req:Request, res:Response) {
    try {
        const result = await gdprSalesOrder(req.params.SalesOrderNo);
        res.json({result});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("execGDPRSORequest()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in execGDPRSORequest'});
    }
}

interface SOHistoryRow extends RowDataPacket {
    SalesOrderNo: string;
    BillToName: string;
    BillToAddress1: string;
    ShipToName: string;
    ShipToAddress1: string;
    EmailAddress: string;
}

interface ARInvHistoryRow extends RowDataPacket {
    InvoiceNo: string;
    BillToName: string;
    BillToAddress1: string;
    ShipToName: string;
    ShipToAddress1: string;
    EmailAddress: string;
}

interface LoadOrdersResponse {
    orders: SOHistoryRow[];
    invoices: ARInvHistoryRow[];
}

interface GDPRSalesOrderResult {
    args: {SalesOrderNo: string};
    rSOH: ResultSetHeader;
    rARH: ResultSetHeader;
    rShFF: ResultSetHeader;
    rShOH: ResultSetHeader;
}

interface SalesOrderHistoryRow extends RowDataPacket {
    SalesOrderNo: string;
}
