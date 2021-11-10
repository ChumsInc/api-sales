const debug = require('debug')('chums:lib:sales:salesorder:sales-order');
const {mysql2Pool} = require('chums-local-modules');

const querySOHeader = `
SELECT Company, SalesOrderNo, OrderDate, OrderType, OrderStatus, ShipExpireDate,
       ARDivisionNo, CustomerNo, ShipToCode, 
       BillToName, BillToAddress1, BillToAddress1, BillToAddress2, BillToAddress3, BillToCity, BillToState, BillToZipCode, BillToCountryCode,
       ShipToName, ShipToAddress1, ShipToAddress1, ShipToAddress2, ShipToAddress3, ShipToCity, ShipToState, ShipToZipCode, ShipToCountryCode,
       ShipVia, CustomerPONo, FOB, WarehouseCode, ConfirmTo, Comment, SalespersonDivisionNo, SalespersonNo, CancelReasonCode,
       TaxableAmt, NonTaxableAmt, SalesTaxAmt, DiscountAmt, UDF_CANCEL_DATE, UDF_PROMO_DEAL
FROM c2.SO_SalesOrderHeader
WHERE Company = :company and SalesOrderNo = :salesOrderNo
`;

const querySODetail = `
SELECT Company, SalesOrderNo, LineKey, LineSeqNo, ItemCode, ItemType, ItemCodeDesc, WarehouseCode, PriceLevel,
       UnitOfMeasure, UnitOfMeasureConvFactor, SalesKitLineKey, ExplodedKitItem, PromiseDate, QuantityOrdered,
       QuantityShipped, QuantityBackordered, UnitPrice, UnitCost, LineDiscountPercent, ExtensionAmt, QuantityPerBill,
       CommentText
FROM c2.SO_SalesOrderDetail
WHERE Company = :company and SalesOrderNo = :salesOrderNo
ORDER BY LineSeqNo
`
async function loadOpenSalesOrder({company, salesOrderNo}) {
    try {

        const [headerRows] = await mysql2Pool.query(querySOHeader, {company, salesOrderNo});
        const [rows] = await mysql2Pool.query(querySODetail, {company, salesOrderNo});
        if (headerRows.length === 0) {
            return {};
        }
        return {
            ...headerRows[0],
            detail: rows
        };
    } catch(err) {
        debug("loadSalesOrder()", err.message);
        return err;
    }
}

async function getOpenSalesOrder(req, res) {
    try {
        const salesOrder = await loadOpenSalesOrder(req.params);
        res.json({salesOrder});
    } catch(err) {
        debug("getOpenSalesOrder()", err.message);
        res.json({error: err.message});
    }
}
exports.getOpenSalesOrder = getOpenSalesOrder;
