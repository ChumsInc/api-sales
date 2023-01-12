const debug = require('debug')('chums:lib:sales:salesorder:open-order-margins');
const {mysql2Pool} = require('chums-local-modules');
const {subHours, startOfDay, format} = require('date-fns');
const numeral = require('numeral');

const promoGLCodes = ['4246', '4311', '6502', '6503', '6507', '6508', '6634', '6635', '6727'];
const promoCustomers = ['CHUMS', 'CHUMSN', 'SAMPLES', 'PROMOS'];
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

         LEFT JOIN  c2.im_itemwarehouse iw
                    ON iw.Company = d.Company AND iw.ItemCode = d.ItemCode AND iw.WarehouseCode = d.WarehouseCode
         LEFT JOIN  c2.IM_ItemWarehouseAdditional ia
                    ON ia.Company = h.Company AND ia.ItemCode = d.ItemCode AND ia.WarehouseCode = d.WarehouseCode
         LEFT JOIN  c2.IM_KitComponentCost ik
                    ON ik.Company = d.Company AND ik.ItemCode = d.ItemCode AND ik.WarehouseCode = d.WarehouseCode
         LEFT JOIN  c2.gl_account a_cost
                    ON a_cost.Company = d.Company AND a_cost.AccountKey = d.CostOfGoodsSoldAcctKey
         LEFT JOIN  c2.gl_account a_sales
                    ON a_sales.Company = d.Company AND a_sales.AccountKey = d.SalesAcctKey
    WHERE h.Company = :company
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
                    u.firstname                                                          AS CreatedBy,
                    u2.firstname                                                         AS LastUpdatedBy,
                    IFNULL(b2b.userid, b2b_c.userid)                                     AS b2bUserID,
                    uu.name                                                              AS b2bUserName,
                    uu.Company                                                           AS B2BCompany,
                    IF(ISNULL(edi.CustomerNo), 'N', 'Y')                                 AS isEDI,
                    FROM_UNIXTIME(UNIX_TIMESTAMP(DateUpdated) + h.TimeUpdated * 60 * 60) AS DateUpdated,
                    isPromo
    FROM c2.SO_SalesOrderHeader h
         INNER JOIN (
                    SELECT h.Company,
                           h.SalesOrderNo,
                           SUM(d.ExtensionAmt)                                                   AS ItemTotal,
                           SUM(IFNULL(
                                           IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                           d.UnitOfMeasureConvFactor,
                                           d.UnitCost) *
                               (d.QuantityOrdered - d.QuantityShipped))                          AS CostTotal,
                           SUM(d.ExtensionAmt) -
                           SUM(IFNULL(
                                           IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                           d.UnitOfMeasureConvFactor,
                                           d.UnitCost
                                   ) *
                               (d.QuantityOrdered - d.QuantityShipped))                          AS Revenue,
                           IFNULL(
                                       SUM((d.ExtensionAmt) -
                                           (IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                                   d.UnitOfMeasureConvFactor,
                                                   d.UnitCost) *
                                            (d.QuantityOrdered - d.QuantityShipped)))
                                       / SUM(d.ExtensionAmt),
                                       IF(SUM(d.QuantityOrdered - d.QuantityShipped) < 0, 1, 0)) AS Margin,
                           COUNT(d.LineSeqNo) =
                           SUM(a.MainAccountCode IN (:promoGLCodes)
                               OR a2.MainAccountCode IN
                                  (:promoGLCodes)
                               OR h.CustomerNo IN (:promoCustomers))                             AS isPromo
                    FROM c2.SO_SalesOrderHeader h
                         INNER JOIN c2.SO_SalesOrderDetail d
                                    ON d.Company = h.Company AND d.SalesOrderNO = h.SalesOrderNo
                         INNER JOIN c2.gl_account a
                                    ON a.Company = d.Company AND a.AccountKey = d.SalesAcctKey
                         LEFT JOIN c2.gl_account a2
                                    ON a2.Company = d.Company AND a2.AccountKey = d.CostOfGoodsSoldAcctKey
                         LEFT JOIN  c2.im_itemwarehouse iw
                                    ON iw.Company = d.Company AND iw.ItemCode = d.ItemCode AND
                                       iw.WarehouseCode = h.WarehouseCode
                         LEFT JOIN  c2.IM_ItemWarehouseAdditional ia
                                    ON ia.Company = h.Company AND ia.ItemCode = d.ItemCode AND
                                       ia.WarehouseCode = h.WarehouseCode
                         LEFT JOIN  c2.IM_KitComponentCost ik
                                    ON ik.Company = d.Company AND ik.ItemCode = d.ItemCode AND
                                       ik.WarehouseCode = h.WarehouseCode
                    WHERE h.OrderType NOT IN ('Q', 'M')
                      AND (IFNULL(d.SalesKitLineKey, '') = '' OR d.SalesKitLineKey = d.LineKey)
                      AND (IFNULL(:filterPromo, '0') = '0' OR
                           a.MainAccountCode NOT IN (:promoGLCodes))
                      AND (IFNULL(:filterPromo, '0') = '0' OR
                           a2.MainAccountCode NOT IN (:promoGLCodes))
                      AND (IFNULL(:filterCloseout, '0') = '0' OR
                           IFNULL(ia.ItemStatus, '') NOT IN ('D2B', 'D2C', 'D3', 'D4'))
                      AND d.ItemCode <> '/RETAIL FREIGHT'
                      AND (IFNULL(:since, '') = '' OR FROM_UNIXTIME(UNIX_TIMESTAMP(h.DateUpdated) + h.TimeUpdated * 60 * 60) >= :since)
                    GROUP BY Company, SalesOrderNo
                    ) d
                    ON d.Company = h.Company AND d.SalesOrderNO = h.SalesOrderNo
         LEFT JOIN  c2.sy_user u
                    ON u.userkey = h.UserCreatedKey
         LEFT JOIN  c2.sy_user u2
                    ON u2.userkey = h.UserUpdatedKey
         LEFT JOIN  b2b.SalesOrderPromoteLog b2b
                    ON b2b.dbCompany = h.Company AND b2b.SalesOrderNo = h.SalesOrderNo
         LEFT JOIN  b2b.SalesOrderCreateLog b2b_c
                    ON b2b_c.dbCompany = h.Company AND b2b_c.SalesOrderNo = h.SalesOrderNo
         LEFT JOIN  users.users uu
                    ON uu.id = IFNULL(b2b.userid, b2b_c.userid)
         LEFT JOIN  c2.AR_EDICustomer edi
                    ON edi.company = h.Company AND edi.ARDivisionNo = h.ARDivisionNo AND edi.CustomerNo = h.CustomerNo
    WHERE h.Company = :company
      AND h.OrderType NOT IN ('Q', 'M')
      AND (IFNULL(:filterBO, '0') = '0' OR h.OrderType <> 'B')
      AND (IFNULL(:filterPromo, '0') = '0' OR h.CustomerNo NOT IN (:promoCustomers))
      AND (IFNULL(:filterCloseout, '0') = '0' OR h.ARDivisionNo NOT IN ('09'))
      AND (IFNULL(:filterEDI, '0') = '0' OR edi.CustomerNo IS NULL)
      AND IF(:maxMargin >= 1, TRUE, d.Margin < :maxMargin)
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
         INNER JOIN (
                    SELECT h.Company,
                           h.InvoiceNo,
                           h.InvoiceType,
                           SUM(d.ExtensionAmt)                                   AS ItemTotal,
                           SUM(IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) * d.UnitOfMeasureConvFactor,
                                      d.UnitCost) *
                               d.QuantityOrdered)                                AS CostTotal,
                           SUM(d.ExtensionAmt) - SUM(
                                       IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                              d.UnitOfMeasureConvFactor,
                                              d.UnitCost) * (d.QuantityShipped)) AS Revenue,
                           IFNULL(SUM((d.ExtensionAmt) -
                                      (IFNULL(IFNULL(ik.AverageCost, NULLIF(iw.AverageCost, 0)) *
                                              d.UnitOfMeasureConvFactor,
                                              d.UnitCost) *
                                       (d.QuantityShipped)))
                                      / SUM(d.ExtensionAmt), 0)                  AS Margin
                    FROM c2.ar_invoicehistoryheader h
                         INNER JOIN c2.ar_invoicehistorydetail d
                                    ON d.Company = h.Company AND d.InvoiceNo = h.InvoiceNo
                         LEFT JOIN  c2.im_itemwarehouse iw
                                    ON iw.Company = d.Company AND iw.ItemCode = d.ItemCode AND
                                       iw.WarehouseCode = d.WarehouseCode
                         LEFT JOIN  c2.IM_ItemWarehouseAdditional ia
                                    ON ia.Company = h.Company AND ia.ItemCode = d.ItemCode AND
                                       ia.WarehouseCode = d.WarehouseCode
                         LEFT JOIN  c2.IM_KitComponentCost ik
                                    ON ik.Company = d.Company AND ik.ItemCode = d.ItemCode AND
                                       ik.WarehouseCode = d.WarehouseCode
                    WHERE h.company = 'chums'
                      AND h.InvoiceType NOT IN ('IN', 'XD')
                      AND h.InvoiceDate >= :since
                      AND d.ExplodedKitItem <> 'C'
                    GROUP BY Company, InvoiceNo
                    ) d
                    ON d.Company = h.Company AND d.InvoiceNo = h.InvoiceNo
         LEFT JOIN  c2.AR_EDICustomer edi
                    ON edi.company = h.Company AND edi.ARDivisionNo = h.ARDivisionNo AND edi.CustomerNo = h.CustomerNo
    WHERE h.Company = 'chums'
      AND ABS(d.CostTotal) > 0
      AND d.Margin < :maxMargin`;

async function loadOrders({
                              company,
                              maxMargin = 0.5,
                              filterEDI = '0',
                              filterPromo = '0',
                              since = '',
                              filterCloseout = '0',
                              filterBO = '0'
                          }) {
    try {
        if (!!since && Number(since) > 0) {
            since = subHours(new Date(), Number(since));
        } else {
            since = '';
        }
        const data = {
            company,
            maxMargin: Number(maxMargin),
            filterEDI,
            filterPromo,
            since,
            filterCloseout,
            filterBO,
            promoGLCodes,
            promoCustomers,
        };
        // debug('loadOrders()', data);
        const [rows] = await mysql2Pool.query(queryOrdersList, data);
        rows.forEach(row => {
            row.OrderTotal = Number(row.OrderTotal);
            row.ItemTotal = Number(row.ItemTotal);
            row.CostTotal = Number(row.CostTotal);
            row.Revenue = Number(row.Revenue);
            row.Margin = Number(row.Margin);
        });
        return rows;
    } catch (err) {
        debug("loadOrders()", err.message);
        return err;
    }
}

async function loadInvoices({company, maxMargin, since}) {
    try {
        if (!!since && Number(since) > 0) {
            since = subHours(new Date(), Number(since));
        } else {
            since = '';
        }
        const data = {company, maxMargin: Number(maxMargin), since: since};
        // debug('loadOrders()', data);
        const [rows] = await mysql2Pool.query(queryCreditMemos, data);
        rows.forEach(row => {
            row.InvoiceTotal = Number(row.InvoiceTotal);
            row.ItemTotal = Number(row.ItemTotal);
            row.CostTotal = Number(row.CostTotal);
            row.Revenue = Number(row.Revenue);
            row.Margin = Number(row.Margin);
        });
        return rows;
    } catch (err) {
        debug("loadInvoices()", err.message);
        return err;
    }
}

async function getOrderMargins(req, res) {
    try {
        const orders = await loadOrders({...req.query, ...req.params});
        res.json({orders});
    } catch (err) {
        debug("getOrders()", err.message);
        res.json({error: err.message});
    }
}

exports.getOrderMargins = getOrderMargins;

async function getCMMargins(req, res) {
    try {
        const invoices = await loadInvoices({...req.query, ...req.params});

        res.json({invoices});
    } catch (err) {
        debug("getCMMargins()", err.message);
        res.json({error: err.message});
    }
}

exports.getCMMargins = getCMMargins;

async function renderOrderMargins(req, res) {
    try {
        const orders = await loadOrders({...req.query, ...req.params});
        const invoices = await loadInvoices({...req.query, ...req.params});
        if (orders.length === 0 && invoices.length === 0) {
            res.status(301).send();
            return;
        }
        res.render('./sales/order-margins.pug', {
            ...req.params,
            ...req.query,
            orders,
            invoices,
            numeral,
            format,
            since: req.query.since ? subHours(new Date(), Number(req.query.since)) : null,
        });
        // res.json({orders});
    } catch (err) {
        debug("getOrders()", err.message);
        res.json({error: err.message});
    }
}

exports.renderOrderMargins = renderOrderMargins;

async function loadSOItemMargins({company, salesOrderNo}) {
    try {
        const [rows] = await mysql2Pool.query(querySalesOrder, {company, salesOrderNo});
        rows.forEach(row => {
            row.QuantityOrdered = Number(row.QuantityOrdered);
            row.QuantityShipped = Number(row.QuantityShipped);
            row.UnitOfMeasureConvFactor = Number(row.UnitOfMeasureConvFactor);
            row.AverageCost = Number(row.AverageCost);
            row.UnitPrice = Number(row.UnitPrice);
            row.ItemTotal = Number(row.ItemTotal);
            row.CostTotal = Number(row.CostTotal);
            row.Revenue = Number(row.Revenue);
            row.Margin = Number(row.Margin);
        })
        return rows;
    } catch (err) {
        debug("loadSOItemMargins()", err.message);
        return err;
    }
}

async function getOrderItemMargins(req, res) {
    try {
        const items = await loadSOItemMargins(req.params);
        res.json({items});
    } catch (err) {
        debug("getOrderItemMargins()", err.message);
        res.json({error: err.message});
    }
}

exports.getOrderItemMargins = getOrderItemMargins;
