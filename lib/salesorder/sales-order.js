import Debug from "debug";
import {apiFetchJSON, getSageCompany, mysql2Pool} from 'chums-local-modules';
import Decimal from "decimal.js";

const debug = Debug('chums:lib:sales:salesorder:sales-order');

const queryOpenSOHeader = `
    SELECT Company,
           SalesOrderNo,
           OrderDate,
           OrderType,
           OrderStatus,
           ShipExpireDate,
           ARDivisionNo,
           CustomerNo,
           ShipToCode,
           BillToName,
           BillToAddress1,
           BillToAddress1,
           BillToAddress2,
           BillToAddress3,
           BillToCity,
           BillToState,
           BillToZipCode,
           BillToCountryCode,
           ShipToName,
           ShipToAddress1,
           ShipToAddress1,
           ShipToAddress2,
           ShipToAddress3,
           ShipToCity,
           ShipToState,
           ShipToZipCode,
           ShipToCountryCode,
           ShipVia,
           CustomerPONo,
           FOB,
           WarehouseCode,
           ConfirmTo,
           Comment,
           SalespersonDivisionNo,
           SalespersonNo,
           CancelReasonCode,
           TaxableAmt,
           NonTaxableAmt,
           SalesTaxAmt,
           DiscountAmt,
           UDF_CANCEL_DATE,
           UDF_PROMO_DEAL
    FROM c2.SO_SalesOrderHeader
    WHERE Company = :company
      AND SalesOrderNo = :salesOrderNo
`;

const queryOpenSODetail = `
    SELECT d.Company,
           d.SalesOrderNo,
           d.LineKey,
           d.LineSeqNo,
           d.ItemCode,
           d.ItemType,
           d.ItemCodeDesc,
           d.WarehouseCode,
           d.PriceLevel,
           d.UnitOfMeasure,
           d.UnitOfMeasureConvFactor,
           d.SalesKitLineKey,
           d.ExplodedKitItem,
           d.PromiseDate,
           d.QuantityOrdered,
           d.QuantityShipped,
           d.QuantityBackordered,
           d.UnitPrice,
           d.UnitCost,
           d.LineDiscountPercent,
           d.ExtensionAmt,
           d.QuantityPerBill,
           d.CommentText,
           i.SuggestedRetailPrice,
           iw.QuantityOnHand,
           iw.QuantityRequiredForWO,
           iw.QuantityOnSalesOrder,
           iw.QuantityOnBackOrder,
           iw.QuantityOnWorkOrder,
           iw.QuantityOnPurchaseOrder,
           iw.BinLocation,
           i.ShipWeight,
           i.ProductType,
           i.ProductLine,
           i.UDF_UPC,
           i.UDF_UPC_BY_COLOR,
           bcd.UPC AS CustomerUPC
    FROM c2.SO_SalesOrderDetail d
             LEFT JOIN c2.ci_item i
                       ON i.company = d.Company AND
                          i.ItemCode = d.ItemCode
             LEFT JOIN c2.im_itemwarehouse iw
                       ON iw.company = i.company AND
                          iw.ItemCode = i.ItemCode AND
                          iw.WarehouseCode = d.WarehouseCode
             LEFT JOIN c2.SO_SalesOrderHeader h
                       ON h.Company = d.Company AND
                          h.SalesOrderNo = d.SalesOrderNo
             LEFT JOIN barcodes.bc_customer bcc
                       ON bcc.Company = h.Company AND
                          bcc.ARDivisionNo = h.ARDivisionNo AND
                          bcc.CustomerNo = h.CustomerNo
             LEFT JOIN barcodes.bc_customerdetail bcd
                       ON bcd.CustomerID = bcc.id AND
                          bcd.ItemNumber = d.ItemCode

    WHERE d.Company = :company
      AND d.SalesOrderNo = :salesOrderNo
    ORDER BY LineSeqNo
`

const sqlSOHeader = `
    SELECT h.Company,
           h.SalesOrderNo,
           h.OrderDate,
           IFNULL(o.OrderType, 'S')                  AS OrderType,
           h.OrderStatus,
           o.ShipExpireDate                          AS ShipExpireDate,
           h.ARDivisionNo,
           h.CustomerNo,
           h.ShipToCode,
           h.BillToName,
           h.BillToAddress1,
           h.BillToAddress1,
           h.BillToAddress2,
           h.BillToAddress3,
           h.BillToCity,
           h.BillToState,
           h.BillToZipCode,
           h.BillToCountryCode,
           h.ShipToName,
           h.ShipToAddress1,
           h.ShipToAddress1,
           h.ShipToAddress2,
           h.ShipToAddress3,
           h.ShipToCity,
           h.ShipToState,
           h.ShipToZipCode,
           h.ShipToCountryCode,
           h.ShipVia,
           h.CustomerPONo,
           h.FOB,
           h.WarehouseCode,
           h.ConfirmTo,
           h.Comment,
           h.SalespersonDivisionNo,
           h.SalespersonNo,
           h.CancelReasonCode,
           h.TaxableAmt,
           h.NonTaxableAmt,
           h.SalesTaxAmt,
           h.DiscountAmt,
           h.UDF_CANCEL_DATE,
           h.UDF_PROMO_DEAL,
           h.LastInvoiceNo,
           h.LastInvoiceDate,
           tc.TermsCodeDesc,
           h.UserCreatedKey,
           CONCAT_WS('/', u.firstname, u2.firstname) AS UserFirstName
    FROM c2.SO_SalesOrderHistoryHeader h
             LEFT JOIN c2.SO_SalesOrderHeader o
                       USING (Company, SalesOrderNo)
             LEFT JOIN c2.ar_termscode tc ON tc.Company = h.Company AND tc.TermsCode = h.TermsCode
             LEFT JOIN c2.sy_user u ON u.userkey = h.UserCreatedKey
             LEFT JOIN c2.sy_user u2 ON u2.userkey = h.UserUpdatedKey
    WHERE h.Company = :company
      AND h.SalesOrderNo = :salesOrderNo
`

const sqlSODetail = `
    SELECT d.Company,
           d.SalesOrderNo,
           d.LineKey,
           IFNULL(o.LineSeqNo, SequenceNo) AS LineSeqNo,
           d.ItemCode,
           d.ItemType,
           d.ItemCodeDesc,
           d.WarehouseCode,
           d.PriceLevel,
           d.UnitOfMeasure,
           d.UnitOfMeasureConvFactor,
           d.SalesKitLineKey,
           d.ExplodedKitItem,
           d.PromiseDate,
           d.QuantityOrderedRevised        AS QuantityOrdered,
           d.QuantityShipped,
           d.QuantityBackordered,
           LastUnitPrice                   AS UnitPrice,
           d.UnitCost,
           d.LineDiscountPercent,
           d.LastExtensionAmt              AS ExtensionAmt,
           d.QuantityPerBill,
           d.CommentText,
           i.SuggestedRetailPrice,
           iw.QuantityOnHand,
           iw.QuantityRequiredForWO,
           iw.QuantityOnSalesOrder,
           iw.QuantityOnBackOrder,
           iw.QuantityOnWorkOrder,
           iw.QuantityOnPurchaseOrder,
           iw.BinLocation,
           i.ShipWeight,
           i.ProductType,
           i.ProductLine,
           i.UDF_UPC,
           i.UDF_UPC_BY_COLOR,
           bcd.UPC                         AS CustomerUPC
    FROM c2.SO_SalesOrderHistoryDetail d
             LEFT JOIN c2.SO_SalesOrderDetail o
                       USING (Company, SalesOrderNo, LineKey)
             LEFT JOIN c2.ci_item i
                       ON i.company = d.Company AND
                          i.ItemCode = d.ItemCode
             LEFT JOIN c2.im_itemwarehouse iw
                       ON iw.company = i.company AND
                          iw.ItemCode = i.ItemCode AND
                          iw.WarehouseCode = d.WarehouseCode
             LEFT JOIN c2.SO_SalesOrderHeader h
                       ON h.Company = d.Company AND
                          h.SalesOrderNo = d.SalesOrderNo
             LEFT JOIN barcodes.bc_customer bcc
                       ON bcc.Company = h.Company AND
                          bcc.ARDivisionNo = h.ARDivisionNo AND
                          bcc.CustomerNo = h.CustomerNo
             LEFT JOIN barcodes.bc_customerdetail bcd
                       ON bcd.CustomerID = bcc.id AND
                          bcd.ItemNumber = d.ItemCode
    WHERE d.Company = :company
      AND d.SalesOrderNo = :salesOrderNo
      AND d.QuantityOrderedRevised <> 0
    ORDER BY LineSeqNo
`;

const sqlInvoices = `SELECT InvoiceNo, HeaderSeqNo, InvoiceDate, InvoiceType
                     FROM c2.ar_invoicehistoryheader
                     WHERE Company = :company
                       AND SalesOrderNo = :salesOrderNo
                       AND InvoiceType <> 'XD'`;

const sqlUsers = `SELECT JSON_OBJECT('name', CONCAT(u.firstname, ' ', u.lastname),
                                     'email', u.EmailAddress) AS user
                  FROM c2.SO_SalesOrderHistoryHeader hh
                           INNER JOIN c2.sy_user u ON u.userkey = hh.UserCreatedKey
                  WHERE hh.Company = :company
                    AND hh.SalesOrderNo = :salesOrderNo
                    AND u.userlogon <> 'websites'

                  UNION

                  SELECT JSON_OBJECT('name', CONCAT(u.firstname, ' ', u.lastname),
                                     'email', u.EmailAddress) AS user
                  FROM c2.SO_SalesOrderHistoryHeader hh
                           INNER JOIN c2.sy_user u ON u.userkey = hh.UserUpdatedKey
                  WHERE hh.Company = :company
                    AND hh.SalesOrderNo = :salesOrderNo

                  UNION

                  SELECT DISTINCT JSON_OBJECT('name', IF(u.accountType = 1, u.name, u.Company),
                                              'email', u.email) AS user
                  FROM b2b.SalesOrderHistory h
                           INNER JOIN users.users u ON u.id = h.UserID
                  WHERE h.dbCompany = :company
                    AND h.SalesOrderNo = :salesOrderNo

                  UNION

                  SELECT DISTINCT JSON_OBJECT('name', IF(u.accountType = 1, u.name, u.Company),
                                              'email', u.email) AS user
                  FROM b2b.SalesOrderLog l
                           INNER JOIN users.users u ON u.id = l.UserID
                  WHERE l.dbCompany = :company
                    AND l.SalesOrderNo = :salesOrderNo`;

const sqlCustomerUPC = `SELECT hd.ItemCode, bcd.UPC
                        FROM c2.SO_SalesOrderHistoryHeader hh
                                 INNER JOIN c2.SO_SalesOrderHistoryDetail hd
                                            ON hd.Company = hh.Company AND hd.SalesOrderNo = hh.SalesOrderNo
                                 LEFT JOIN barcodes.bc_customer bcc
                                           ON bcc.Company = hh.Company AND bcc.ARDivisionNo = hh.ARDivisionNo AND
                                              bcc.CustomerNo = hh.CustomerNo
                                 LEFT JOIN barcodes.bc_customerdetail bcd
                                           ON bcd.CustomerID = bcc.id AND bcd.ItemNumber = hd.ItemCode
                        WHERE hh.Company = :company
                          AND hh.SalesOrderNo = :salesOrderNo`

async function loadOpenSalesOrder({company, salesOrderNo}) {
    try {

        const [headerRows] = await mysql2Pool.query(queryOpenSOHeader, {company, salesOrderNo});
        const [rows] = await mysql2Pool.query(queryOpenSODetail, {company, salesOrderNo});
        const [users] = await mysql2Pool.query(sqlUsers, {company, salesOrderNo})
        if (headerRows.length === 0) {
            const [salesOrder] = await apiFetchJSON(`https://intranet.chums.com/node-sage/api/${getSageCompany(company)}/salesorder/${encodeURIComponent(salesOrderNo)}`);
            return salesOrder ?? {};
        }
        return {
            ...headerRows[0],
            detail: rows,
            b2bUsers: users.map(row => JSON.parse(row.user))
        };
    } catch (err) {
        debug("loadSalesOrder()", err.message);
        return err;
    }
}

export async function getOpenSalesOrder(req, res) {
    try {
        const salesOrder = await loadOpenSalesOrder(req.params);
        res.json({salesOrder});
    } catch (err) {
        debug("getOpenSalesOrder()", err.message);
        res.json({error: err.message});
    }
}


async function loadSalesOrder({company, salesOrderNo}) {
    try {
        const [headerRows] = await mysql2Pool.query(sqlSOHeader, {company, salesOrderNo});
        const [rows] = await mysql2Pool.query(sqlSODetail, {company, salesOrderNo});
        const [invoices] = await mysql2Pool.query(sqlInvoices, {company, salesOrderNo});
        const [users] = await mysql2Pool.query(sqlUsers, {company, salesOrderNo})
        if (headerRows.length === 0) {
            const [salesOrder] = await apiFetchJSON(`https://intranet.chums.com/node-sage/api/${getSageCompany(company)}/salesorder/${encodeURIComponent(salesOrderNo)}`);
            return salesOrder ?? {};
        }
        return {
            ...headerRows[0],
            detail: rows.map(row => {
                    const QuantityCommitted = new Decimal(row.QuantityOnSalesOrder ?? 0)
                        .add(row.QuantityOnBackOrder ?? 0)
                        .add(row.QuantityRequiredForWO ?? 0).toString();
                    const QuantityOnWOPO = new Decimal(row.QuantityOnWorkOrder ?? 0).add(row.QuantityOnPurchaseOrder ?? 0).toString();
                    const QuantityImmediateAvailable = new Decimal(row.QuantityOnHand ?? 0).sub(QuantityCommitted).toString();
                    const QuantityAvailable = new Decimal(QuantityImmediateAvailable).add(QuantityOnWOPO).toString();
                    return {
                        ...row,
                        QuantityCommitted,
                        QuantityOnWOPO,
                        QuantityImmediateAvailable,
                        QuantityAvailable
                    }
                },
            ),
            Invoices: invoices ?? [],
            b2bUsers: users.map(row => JSON.parse(row.user))
        };
    } catch (err) {
        if (err instanceof Error) {
            debug("loadSalesOrder()", err.message);
            return Promise.reject(err);
        }
        debug("loadSalesOrder()", err);
        return Promise.reject(new Error('Error in loadSalesOrder()'));
    }
}

export async function getSalesOrder(req, res) {
    try {
        const salesOrder = await loadSalesOrder(req.params);
        res.json({salesOrder});
    } catch (err) {
        debug("getSalesOrder()", err.message);
        res.json({error: err.message});
    }
}
