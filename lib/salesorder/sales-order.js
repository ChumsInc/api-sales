import Debug from "debug";
import {apiFetch, getSageCompany, mysql2Pool} from 'chums-local-modules';

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
      and SalesOrderNo = :salesOrderNo
`;

const queryOpenSODetail = `
    SELECT Company,
           SalesOrderNo,
           LineKey,
           LineSeqNo,
           ItemCode,
           ItemType,
           ItemCodeDesc,
           WarehouseCode,
           PriceLevel,
           UnitOfMeasure,
           UnitOfMeasureConvFactor,
           SalesKitLineKey,
           ExplodedKitItem,
           PromiseDate,
           QuantityOrdered,
           QuantityShipped,
           QuantityBackordered,
           UnitPrice,
           UnitCost,
           LineDiscountPercent,
           ExtensionAmt,
           QuantityPerBill,
           CommentText
    FROM c2.SO_SalesOrderDetail
    WHERE Company = :company
      and SalesOrderNo = :salesOrderNo
    ORDER BY LineSeqNo
`

const sqlSOHeader = `
    SELECT h.Company,
           h.SalesOrderNo,
           h.OrderDate,
           IFNULL(o.OrderType, 'S') AS OrderType,
           h.OrderStatus,
           o.ShipExpireDate         AS ShipExpireDate,
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
           h.UDF_PROMO_DEAL
    FROM c2.SO_SalesOrderHistoryHeader h
             LEFT JOIN c2.SO_SalesOrderHeader o
                       USING (Company, SalesOrderNo)
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
           d.CommentText
    FROM c2.SO_SalesOrderHistoryDetail d
             LEFT JOIN c2.SO_SalesOrderDetail o
                       USING (Company, SalesOrderNo, LineKey)
    WHERE d.Company = :company
      AND d.SalesOrderNo = :salesOrderNo
    ORDER BY LineSeqNo
`

async function loadOpenSalesOrder({company, salesOrderNo}) {
    try {

        const [headerRows] = await mysql2Pool.query(queryOpenSOHeader, {company, salesOrderNo});
        const [rows] = await mysql2Pool.query(queryOpenSODetail, {company, salesOrderNo});
        if (headerRows.length === 0) {
            const [salesOrder] = await apiFetch(`/node-sage/api/${getSageCompany(company)}/salesorder/${encodeURIComponent(salesOrderNo)}`);
            return salesOrder ?? {};
        }
        return {
            ...headerRows[0],
            detail: rows
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
        if (headerRows.length === 0) {
            const [salesOrder] = await apiFetch(`/node-sage/api/${getSageCompany(company)}/salesorder/${encodeURIComponent(salesOrderNo)}`);
            return salesOrder ?? {};
        }
        return {
            ...headerRows[0],
            detail: rows
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
