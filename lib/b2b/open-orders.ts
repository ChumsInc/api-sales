import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import {SalesOrder, SalesOrderDetailLine, SalesOrderHeader} from "chums-types";
import {RowDataPacket} from "mysql2";
import {Request, Response} from 'express'
import {loadImages} from "../utils/images.js";


const debug = Debug("chums:lib:b2b:open-orders");


export interface LoadOpenOrdersProps {
    arDivisionNo: string;
    customerNo: string;
    salesOrderNo?: string;
    userId: number|string;
}

async function loadOpenOrderDetail(salesOrderNo:string):Promise<SalesOrderDetailLine[]> {
    try {
        const sql = `
            SELECT d.LineKey,
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
                   i.StandardUnitPrice,
                   i.SuggestedRetailPrice,
                   d.Valuation,
                   d.LotSerialFullyDistributed,
                   i.UDF_UPC,
                   i.UDF_UPC_BY_COLOR,
                   '' AS emptyField,
                   d.MasterOriginalQty,
                   d.MasterQtyBalance,
                   d.MasterQtyOrderedToDate,
                   d.RepeatingQtyShippedToDate,
                   i.ShipWeight,
                   i.ProductType,
                   i.InactiveItem,
                   i.ProductLine,
                   d.UDF_SHIP_CODE
            FROM c2.SO_SalesOrderDetail d
                 LEFT JOIN c2.CI_Item i ON d.ItemCode = i.ItemCode
            WHERE d.SalesOrderNo = :salesOrderNo
            ORDER BY d.LineSeqNo`;
        const [rows] = await mysql2Pool.query<(SalesOrderDetailLine & RowDataPacket)[]>(sql, {salesOrderNo});
        const itemCodes = rows.filter(item => item.ItemType === '1').map(item => item.ItemCode);
        const images = await loadImages(itemCodes);
        return rows.map(row => {
            let [image] = images.filter(img => img.ItemCode === row.ItemCode).filter(img => !!img.preferred_image);
            if (!image) {
                [image] = images.filter(img => img.ItemCode === row.ItemCode);
            }
            return {
                ...row,
                image: image?.filename ?? null,
            }
        });
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadOpenOrderDetail()", err.message);
            return Promise.reject(err);
        }
        debug("loadOpenOrderDetail()", err);
        return Promise.reject(new Error('Error in loadOpenOrderDetail()'));
    }
}
async function loadOpenOrders({arDivisionNo, customerNo, salesOrderNo, userId}:LoadOpenOrdersProps):Promise<SalesOrder[]> {
    try {
        const query = `SELECT h.Company,
                              h.SalesOrderNo,
                              h.OrderDate,
                              h.OrderType,
                              h.OrderStatus,
                              h.ARDivisionNo,
                              h.CustomerNo,
                              h.BillToName,
                              h.BillToAddress1,
                              h.BillToAddress2,
                              h.BillToAddress3,
                              h.BillToCity,
                              h.BillToState,
                              h.BillToZipCode,
                              h.BillToCountryCode,
                              ''          AS BillToCountryName,
                              h.ShipToCode,
                              h.ShipToName,
                              h.ShipToAddress1,
                              h.ShipToAddress2,
                              h.ShipToAddress3,
                              h.ShipToCity,
                              h.ShipToState,
                              h.ShipToZipCode,
                              h.ShipToCountryCode,
                              ''          AS ShipToCountryName,
                              h.ShipExpireDate,
                              h.ShipVia,
                              h.CustomerPONo,
                              h.FOB,
                              h.WarehouseCode,
                              h.ConfirmTo,
                              h.Comment,
                              h.TermsCode,
                              tc.TermsCodeDesc,
                              h.LastInvoiceNo,
                              NULL        AS LastInvoiceDate,
                              h.SalespersonDivisionNo,
                              h.SalespersonNo,
                              h.PaymentType,
                              h.CancelReasonCode,
                              (h.TaxableSubjectToDiscount + h.NonTaxableSubjectToDiscount)
                                          AS AmountSubjectToDiscount,
                              h.DiscountRate,
                              h.DiscountAmt,
                              h.TaxableAmt,
                              h.NonTaxableAmt,
                              h.SalesTaxAmt,
                              h.TaxSchedule,
                              h.FreightAmt,
                              h.DepositAmt,
                              h.UserCreatedKey,
                              h.UDF_CANCEL_DATE,
                              h.imprinted AS UDF_IMPRINTED,
                              h.BillToDivisionNo,
                              h.BillToCustomerNo,
                              u.FirstName AS UserFirstName,
                              u.LastName  AS UserLastName,
                              h.PromotedDate
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_AR_Customer
                             WHERE (userid = :userId OR api_id = :api_id)
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userId OR api_id = :api_id)) AS a
                                INNER JOIN c2.SO_SalesOrderHeader h
                                           ON a.Company = h.Company AND a.ARDivisionNo = h.ARDivisionNo AND
                                              a.CustomerNo = h.CustomerNo AND a.ShipToCode = ifnull(h.ShipToCode, '')
                                LEFT JOIN c2.ar_termscode tc
                                          ON tc.Company = h.Company AND tc.TermsCode = h.TermsCode
                                LEFT JOIN c2.sy_user u
                                          ON u.userkey = h.UserCreatedKey
                       WHERE h.Company = 'chums'
                         AND (h.ARDivisionNo = :arDivisionNo OR h.BillToDivisionNo = :arDivisionNo)
                         AND (h.CustomerNo = :customerNo OR BillToCustomerNo = :customerNo)
                         AND (ifnull(:salesOrderNo, '') = '' OR h.SalesOrderNo = :salesOrderNo)
                         AND h.OrderType in ('S', 'B')
                       ORDER BY SalesOrderNo DESC`;
        const api_id = +userId * -1;
        const data = {userId, api_id, arDivisionNo, salesOrderNo, customerNo};
        const [rows] = await mysql2Pool.query<(SalesOrderHeader & RowDataPacket)[]>(query, data);
        const salesOrders:SalesOrder[] = [];
        for await (const salesOrder of rows) {
            const detail = await loadOpenOrderDetail(salesOrder.SalesOrderNo);
            salesOrders.push({...salesOrder, detail, invoices: []})
        }
        return salesOrders;
    } catch(err:unknown) {
        if (err instanceof Error) {
            console.debug("loadOpenOrders()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadOpenOrders()", err);
        return Promise.reject(new Error('Error in loadOpenOrders()'));
    }
}

export const getOpenOrders = async (req:Request, res:Response):Promise<void> => {
    try {
        const [arDivisionNo, customerNo] = (req.params.customerKey ?? '').split('-');
        const params:LoadOpenOrdersProps = {
            arDivisionNo,
            customerNo,
            userId: res.locals!.profile!.user.id
        }
        const list = await loadOpenOrders(params);
        for await (const so of list) {
            so.detail
        }
        res.json({list});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getOpenOrders()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getOpenOrders'});
    }
}

export const getOpenSalesOrder = async (req:Request, res:Response):Promise<void> => {
    try {
        const [arDivisionNo, customerNo] = (req.params.customerKey ?? '').split('-');
        const params:LoadOpenOrdersProps = {
            arDivisionNo,
            customerNo,
            salesOrderNo: req.params.salesOrderNo,
            userId: res.locals!.profile!.user.id
        }
        const [salesOrder] = await loadOpenOrders(params);
        if (!salesOrder) {
            res.json({salesOrder: null})
            return;
        }
        res.json({salesOrder})
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getOpenSalesOrder()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getOpenSalesOrder'});
    }
}
