import Debug from "debug";
import { mysql2Pool } from 'chums-local-modules';
import numeral from 'numeral';
import dayjs from 'dayjs';
const debug = Debug('chums:lib:sales:salesorder:open-order-margins');
const promoGLCodes = ['4246', '4310', '4311', '6502', '6503', '6507', '6508', '6634', '6635', '6727'];
const promoCustomers = ['CHUMS', 'CHUMSN', 'SAMPLES', 'PROMOS', 'TEST'];
const discoItemStatus = ['D2B', 'D2C', 'D3', 'D4'];
const querySalesOrder = `
    SELECT d.LineKey,
           d.ItemCode,
           d.ItemCodeDesc,
           d.QuantityOrderedRevised                          AS QuantityOrdered,
           d.QuantityShipped,
           d.UnitOfMeasure,
           d.UnitOfMeasureConvFactor,
           ia.ItemStatus,

           IF(h.OrderStatus = 'C',
              d.UnitCost,
              IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)),
                     d.UnitCost))                            AS AverageCost,
           d.LastUnitPrice                                   AS UnitPrice,
           d.LastExtensionAmt                                AS ItemTotal,

           IF(h.OrderStatus = 'C',
              d.UnitCost,
              IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) * d.UnitOfMeasureConvFactor, d.UnitCost)) *
           d.QuantityOrderedRevised                          AS CostTotal,

           d.LastExtensionAmt -
           (IF(h.OrderStatus = 'C',
               d.UnitCost,
               (IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) * d.UnitOfMeasureConvFactor, d.UnitCost))) *
            d.QuantityOrderedRevised)                        AS Revenue,

           (d.LastExtensionAmt -
            (IF(h.OrderStatus = 'C',
                d.UnitCost,
                (IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) * d.UnitOfMeasureConvFactor, d.UnitCost))) *
             d.QuantityOrderedRevised)) / d.LastExtensionAmt AS Margin,

           a_cost.Account                                    AS CostAccount,
           a_cost.AccountDesc                                AS CostAccountDesc,
           a_sales.Account                                   AS SalesAccount,
           a_sales.AccountDesc                               AS SalesAccountDesc
    FROM c2.SO_SalesOrderHistoryHeader h
             INNER JOIN c2.SO_SalesOrderHistoryDetail d
                        ON d.Company = h.Company AND d.SalesOrderNO = h.SalesOrderNo

             LEFT JOIN c2.im_itemwarehouse iw
                       ON iw.Company = d.Company AND iw.ItemCode = d.ItemCode AND iw.WarehouseCode = d.WarehouseCode
             LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                       ON ia.Company = h.Company AND ia.ItemCode = d.ItemCode AND ia.WarehouseCode = d.WarehouseCode
             LEFT JOIN c2.IM_KitComponentCost ik
                       ON ik.Company = d.Company AND ik.ItemCode = d.ItemCode AND ik.WarehouseCode = d.WarehouseCode AND
                          ik.Revision = d.Revision
             LEFT JOIN c2.gl_account a_cost
                       ON a_cost.Company = d.Company AND a_cost.AccountKey = d.CostOfGoodsSoldAcctKey
             LEFT JOIN c2.gl_account a_sales
                       ON a_sales.Company = d.Company AND a_sales.AccountKey = d.SalesAcctKey
    WHERE h.Company = 'chums'
      AND h.SalesOrderNo = :salesOrderNo
      AND (IFNULL(d.SalesKitLineKey, '') = '' OR d.SalesKitLineKey = d.LineKey)
    ORDER BY SequenceNo
`;
const queryOrdersList = `
    SELECT DISTINCT h.Company,
                    h.SalesOrderNo,
                    h.OrderType,
                    h.OrderDate,
                    h.ShipExpireDate,
                    h.ARDivisionNo,
                    h.CustomerNo,
                    h.BillToName,
                    h.OrderTotal,
                    d.ItemTotal,
                    d.CostTotal,
                    d.Revenue,
                    d.Margin,
                    (SELECT firstname FROM c2.SY_User WHERE UserKey = h.UserCreatedKey)  AS CreatedBy,
                    (SELECT firstname FROM c2.SY_User WHERE UserKey = h.UserUpdatedKey)  AS LastUpdatedBy,
                    (SELECT id
                     FROM users.users u
                     WHERE u.id = IFNULL(d.b2bPromotedBy, d.b2bCreatedBy))               AS b2bUserID,
                    (SELECT name
                     FROM users.users u
                     WHERE u.id = IFNULL(d.b2bPromotedBy, d.b2bCreatedBy))               AS b2bUserName,
                    (SELECT company
                     FROM users.users u
                     WHERE u.id = IFNULL(d.b2bPromotedBy, d.b2bCreatedBy))               AS B2BCompany,
                    IF(ISNULL(edi.CustomerNo), 'N', 'Y')                                 AS isEDI,
                    FROM_UNIXTIME(UNIX_TIMESTAMP(DateUpdated) + h.TimeUpdated * 60 * 60) AS DateUpdated,
                    d.isPromo
    FROM c2.SO_SalesOrderHeader h
             INNER JOIN (SELECT h.Company,
                                h.SalesOrderNo,
                                SUM(d.ExtensionAmt)                                               AS ItemTotal,
                                SUM(IFNULL(
                                            IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                            d.UnitOfMeasureConvFactor,
                                            d.UnitCost) *
                                    (d.QuantityOrdered - d.QuantityShipped))                      AS CostTotal,
                                SUM(d.ExtensionAmt) -
                                SUM(IFNULL(
                                            IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                            d.UnitOfMeasureConvFactor,
                                            d.UnitCost
                                    ) *
                                    (d.QuantityOrdered - d.QuantityShipped))                      AS Revenue,
                                IFNULL(
                                        SUM(
                                                (d.ExtensionAmt) -
                                            (IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                                    d.UnitOfMeasureConvFactor,
                                                    d.UnitCost) *
                                             (d.QuantityOrdered - d.QuantityShipped)))
                                            / SUM(d.ExtensionAmt),
                                        IF(SUM(d.QuantityOrdered - d.QuantityShipped) < 0, 1, 0)) AS Margin,
                                COUNT(d.LineSeqNo) =
                                SUM(salesGL.MainAccountCode IN
                                    (SELECT MainAccountCode FROM c2.SO_OrderMarginGLAccounts WHERE Company = h.Company)
                                    OR cogsGL.MainAccountCode IN (SELECT MainAccountCode
                                                                  FROM c2.SO_OrderMarginGLAccounts
                                                                  WHERE Company = h.Company)
                                    OR IFNULL(omc.isPromo, 0))                                    AS isPromo,
                                (SELECT l.UserID
                                 FROM b2b.SalesOrderLog l
                                          INNER JOIN users.users u ON u.id = l.UserID
                                 WHERE l.dbCompany = h.Company
                                   AND l.SalesOrderNo = h.SalesOrderNo
                                   AND JSON_EXTRACT(l.action, '$.action') = 'new')                AS b2bCreatedBy,
                                (SELECT l.UserID
                                 FROM b2b.SalesOrderLog l
                                          INNER JOIN users.users u ON u.id = l.UserID
                                 WHERE l.dbCompany = h.Company
                                   AND l.SalesOrderNo = h.SalesOrderNo
                                   AND JSON_EXTRACT(l.action, '$.action') = 'promote')            AS b2bPromotedBy
                         FROM c2.SO_SalesOrderHeader h
                                  INNER JOIN c2.SO_SalesOrderDetail d
                                             ON d.Company = h.Company AND
                                                d.SalesOrderNO = h.SalesOrderNo
                                  INNER JOIN c2.gl_account salesGL
                                             ON salesGL.Company = d.Company AND
                                                salesGL.AccountKey = d.SalesAcctKey
                                  LEFT JOIN c2.gl_account cogsGL
                                            ON cogsGL.Company = d.Company AND
                                               cogsGL.AccountKey = d.CostOfGoodsSoldAcctKey
                                  LEFT JOIN c2.im_itemwarehouse iw
                                            ON iw.Company = d.Company AND
                                               iw.ItemCode = d.ItemCode AND
                                               iw.WarehouseCode = d.WarehouseCode
                                  LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                            ON ia.Company = d.Company AND
                                               ia.ItemCode = d.ItemCode AND
                                               ia.WarehouseCode = d.WarehouseCode
                                  LEFT JOIN c2.IM_KitComponentCost ik
                                            ON ik.Company = d.Company AND
                                               ik.ItemCode = d.ItemCode AND
                                               ik.WarehouseCode = d.WarehouseCode and 
                                               ik.Revision = d.Revision
                                  LEFT JOIN c2.SO_OrderMarginCustomers omc
                                            ON omc.Company = h.Company AND omc.ARDivisionNo = h.ARDivisionNo AND
                                               omc.CustomerNo = h.CustomerNo
                         WHERE h.OrderType NOT IN ('Q', 'M')
                           AND (IFNULL(d.SalesKitLineKey, '') = '' OR d.SalesKitLineKey = d.LineKey)
                           AND (IFNULL(:filterPromo, '0') = '0' OR
                                salesGL.MainAccountCode NOT IN
                                (SELECT MainAccountCode FROM c2.SO_OrderMarginGLAccounts WHERE Company = h.Company))
                           AND (IFNULL(:filterPromo, '0') = '0' OR
                                cogsGL.MainAccountCode NOT IN
                                (SELECT MainAccountCode FROM c2.SO_OrderMarginGLAccounts WHERE Company = h.Company))
                           AND (IFNULL(:filterCloseout, '0') = '0' OR
                                IFNULL(ia.ItemStatus, '') NOT IN ('D2B', 'D2C', 'D3', 'D4'))
                           AND (IFNULL(:filterEmployee, '0') = '0' OR
                                IFNULL(h.ARDivisionNo, '') NOT IN ('10'))
                           AND (IFNULL(:filterEmployee, '0') = '0' OR
                                IFNULL(h.CustomerNo, '') NOT IN ('EMPLOYE'))
                           AND d.ItemCode <> '/RETAIL FREIGHT'
                           AND d.ItemCode not in ('12215', '12405', '13002151D')
                           AND (IFNULL(:since, '') = '' OR
                                FROM_UNIXTIME(UNIX_TIMESTAMP(h.DateUpdated) + h.TimeUpdated * 60 * 60) >= :since)
                         GROUP BY Company, SalesOrderNo) d
                        ON d.Company = h.Company AND
                           d.SalesOrderNO = h.SalesOrderNo
             LEFT JOIN c2.AR_EDICustomer edi
                       ON edi.company = h.Company AND
                          edi.ARDivisionNo = h.ARDivisionNo AND
                          edi.CustomerNo = h.CustomerNo
             LEFT JOIN c2.SO_OrderMarginCustomers omc
                       ON omc.Company = h.Company AND omc.ARDivisionNo = h.ARDivisionNo AND
                          omc.CustomerNo = h.CustomerNo
    WHERE h.Company = 'chums'
      AND h.OrderType NOT IN ('Q', 'M')
      AND (IFNULL(:filterBO, '0') = '0' OR h.OrderType <> 'B')
      AND (IFNULL(:filterPromo, '0') = '0' OR NULLIF(omc.isPromo, 0) IS NULL)
      AND (IFNULL(:filterCloseout, '0') = '0' OR h.ARDivisionNo NOT IN ('09'))
      AND (IFNULL(:filterEDI, '0') = '0' OR edi.CustomerNo IS NULL)
      AND IF(IFNULL(:maxMargin, '') = '', TRUE, d.Margin < :maxMargin)
      # AND IF(IFNULL(:minMargin, '') = '', TRUE, d.Margin > :minMargin)
#       AND (IFNULL(:since, '') = '' OR FROM_UNIXTIME(UNIX_TIMESTAMP(DateUpdated) + h.TimeUpdated * 60 * 60) >= :since)
      AND NOT (d.CostTotal = 0 AND d.ItemTotal = 0)
`;
const queryCreditMemos = `
    SELECT DISTINCT h.Company,
                    h.InvoiceNo,
                    h.InvoiceType,
                    h.InvoiceDate,
                    h.ARDivisionNo,
                    h.CustomerNo,
                    h.BillToName,
                    h.TaxableSalesAmt + h.NonTaxableSalesAmt AS InvoiceTotal,
                    d.ItemTotal,
                    d.CostTotal,
                    d.Revenue,
                    d.Margin
    FROM c2.ar_invoicehistoryheader h
             INNER JOIN (SELECT h.Company,
                                h.InvoiceNo,
                                h.InvoiceType,
                                SUM(d.ExtensionAmt)                               AS ItemTotal,
                                SUM(IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                           d.UnitOfMeasureConvFactor,
                                           d.UnitCost) *
                                    d.QuantityOrdered)                            AS CostTotal,
                                SUM(d.ExtensionAmt) - SUM(
                                        IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                               d.UnitOfMeasureConvFactor,
                                               d.UnitCost) * (d.QuantityShipped)) AS Revenue,
                                IFNULL(SUM((d.ExtensionAmt) -
                                           (IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                                   d.UnitOfMeasureConvFactor,
                                                   d.UnitCost) *
                                            (d.QuantityShipped)))
                                           / SUM(d.ExtensionAmt), 0)              AS Margin
                         FROM c2.ar_invoicehistoryheader h
                                  INNER JOIN c2.ar_invoicehistorydetail d
                                             ON d.Company = h.Company AND d.InvoiceNo = h.InvoiceNo
                                  LEFT JOIN c2.im_itemwarehouse iw
                                            ON iw.Company = d.Company AND iw.ItemCode = d.ItemCode AND
                                               iw.WarehouseCode = d.WarehouseCode
                                  LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                            ON ia.Company = h.Company AND ia.ItemCode = d.ItemCode AND
                                               ia.WarehouseCode = d.WarehouseCode
                                  LEFT JOIN c2.IM_KitComponentCost ik
                                            ON ik.Company = d.Company AND ik.ItemCode = d.ItemCode AND
                                               ik.WarehouseCode = d.WarehouseCode AND ik.Revision = d.Revision
                         WHERE h.company = 'chums'
                           AND h.InvoiceType NOT IN ('IN', 'XD')
                           AND h.InvoiceDate >= :since
                           AND d.ExplodedKitItem <> 'C'
                         GROUP BY Company, InvoiceNo) d
                        ON d.Company = h.Company AND d.InvoiceNo = h.InvoiceNo
             LEFT JOIN c2.AR_EDICustomer edi
                       ON edi.company = h.Company AND edi.ARDivisionNo = h.ARDivisionNo AND
                          edi.CustomerNo = h.CustomerNo
    WHERE h.Company = 'chums'
      AND ABS(d.CostTotal) > 0
      AND d.Margin < :maxMargin;
`;
async function loadOrders({ maxMargin = 0.5, filterEDI = '0', filterPromo = '0', filterEmployee = '0', since = '', filterCloseout = '0', filterBO = '0' }) {
    try {
        if (!!since && Number(since) > 0) {
            since = dayjs().subtract(+since, 'hours').format('YYYY-MM-DD');
        }
        else {
            since = '';
        }
        const data = {
            maxMargin: Number(maxMargin),
            filterEDI,
            filterPromo,
            filterEmployee,
            since,
            filterCloseout,
            filterBO,
            promoGLCodes,
            promoCustomers,
        };
        // debug('loadOrders()', data);
        const [rows] = await mysql2Pool.query(queryOrdersList, data);
        return rows.map(row => ({
            ...row,
            OrderTotal: Number(row.OrderTotal),
            ItemTotal: Number(row.ItemTotal),
            CostTotal: Number(row.CostTotal),
            Revenue: Number(row.Revenue),
            Margin: Number(row.Margin),
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadOrders()", err);
        return Promise.reject(new Error('Error in loadOrders()'));
    }
}
async function loadInvoices({ maxMargin, since }) {
    try {
        if (!!since && Number(since) > 0) {
            since = dayjs().subtract(+since, 'hours').format('YYYY-MM-DD');
        }
        else {
            since = dayjs().subtract(30, 'days').format('YYYY-MM-DD');
        }
        const data = { maxMargin: Number(maxMargin), since: since };
        const [rows] = await mysql2Pool.query(queryCreditMemos, data);
        return rows.map(row => ({
            ...row,
            InvoiceTotal: Number(row.InvoiceTotal),
            ItemTotal: Number(row.ItemTotal),
            CostTotal: Number(row.CostTotal),
            Revenue: Number(row.Revenue),
            Margin: Number(row.Margin),
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInvoices()", err.message);
            return Promise.reject(err);
        }
        debug("loadInvoices()", err);
        return Promise.reject(new Error('Error in loadInvoices()'));
    }
}
function parseOrderMarginProps(req) {
    return {
        filterBO: req.query.filterBO,
        filterCloseout: req.query.filterCloseout,
        filterEmployee: req.query.filterEmployee,
        filterEDI: req.query.filterEDI,
        filterPromo: req.query.filterPromo,
        maxMargin: (req.params.maxMargin ?? req.query.maxMargin),
        since: req.query.since,
    };
}
export async function getOrderMargins(req, res) {
    try {
        const params = parseOrderMarginProps(req);
        const orders = await loadOrders(params);
        res.json({ orders });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getOrderMargins()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getOrderMargins' });
    }
}
function parseInvoiceProps(req) {
    return {
        maxMargin: (req.params.maxMargin ?? req.query.maxMargin),
        since: req.query.since,
    };
}
export async function getCMMargins(req, res) {
    try {
        const params = parseInvoiceProps(req);
        const invoices = await loadInvoices(params);
        res.json({ invoices });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCMMargins()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getCMMargins' });
    }
}
export async function renderOrderMargins(req, res) {
    try {
        const orders = await loadOrders(parseOrderMarginProps(req));
        const invoices = await loadInvoices(parseInvoiceProps(req));
        if (orders.length === 0 && invoices.length === 0) {
            res.status(301).send();
            return;
        }
        const since = req.query.since
            ? dayjs(new Date()).subtract(+(req.query.since), 'hours')
            : null;
        res.render('./sales/order-margins.pug', {
            ...req.params,
            ...req.query,
            orders,
            invoices,
            numeral,
            dayjs,
            since: since,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderOrderMargins()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in renderOrderMargins' });
    }
}
async function loadSOItemMargins({ salesOrderNo }) {
    try {
        const [rows] = await mysql2Pool.query(querySalesOrder, { salesOrderNo });
        return rows.map(row => ({
            ...row,
            QuantityOrdered: Number(row.QuantityOrdered),
            QuantityShipped: Number(row.QuantityShipped),
            UnitOfMeasureConvFactor: Number(row.UnitOfMeasureConvFactor),
            AverageCost: Number(row.AverageCost),
            UnitPrice: Number(row.UnitPrice),
            ItemTotal: Number(row.ItemTotal),
            CostTotal: Number(row.CostTotal),
            Revenue: Number(row.Revenue),
            Margin: Number(row.Margin),
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadSOItemMargins()", err.message);
            return Promise.reject(err);
        }
        debug("loadSOItemMargins()", err);
        return Promise.reject(new Error('Error in loadSOItemMargins()'));
    }
}
export async function getOrderItemMargins(req, res) {
    try {
        const salesOrderNo = req.params.salesOrderNo;
        const items = await loadSOItemMargins({ salesOrderNo });
        res.json({ items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getOrderItemMargins()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getOrderItemMargins' });
    }
}
