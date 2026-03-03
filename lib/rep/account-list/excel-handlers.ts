import type {AccountListProps, RepAccountWithSales, RepOpenCart, RepOpenOrder, RepRecentOrder} from "./account-list-types.d.ts";
import {Decimal} from "decimal.js";
import dayjs from "dayjs";
import {getAccountListDates} from "./utils.js";
import {buildWorkBook, type ColumnNames, resultToExcelSheet, type ValidatedUser} from 'chums-local-modules'
import type {Request, Response} from "express";
import {loadBillToAccountList} from "./bill-to-account-list.js";
import {loadShipToAccountList} from "./ship-to-account-list.js";
import {loadRecentOrders} from "./rep-recent-orders.js";
import {loadOpenOrders} from "./rep-open-orders.js";
import {loadRepCarts} from "./rep-carts.js";
import Debug from 'debug';

const debug = Debug('chums:lib:rep:account-list:excel-handlers');

export function prepBillToAccountRow(row:RepAccountWithSales):RepAccountWithSales {
    return {
        ...row,
        CustomerNo: [row.ARDivisionNo, row.CustomerNo].join('-'),
        SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
        InvCYTD: new Decimal(row.InvCYTD).toNumber(),
        OpenOrders: new Decimal(row.OpenOrders).toNumber(),
        InvPYTD: new Decimal(row.InvPYTD).toNumber(),
        InvPYr: new Decimal(row.InvPYr).toNumber(),
        YTDTotal: new Decimal(row.InvCYTD).add(row.OpenOrders).toNumber(),
        pctChange: new Decimal(row.pctChange).toNumber(),
        CYGoal: new Decimal(row.CYGoal).toNumber(),
        YTDGoalPct: new Decimal(row.YTDGoalPct).toNumber(),
    }
}

export function prepShipToAccountRow(row:RepAccountWithSales):RepAccountWithSales {
    return {
        ...row,
        CustomerNo: `${[row.ARDivisionNo, row.CustomerNo].join('-')}/${row.ShipToCode}` ,
        SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
        InvCYTD: new Decimal(row.InvCYTD).toNumber(),
        OpenOrders: new Decimal(row.OpenOrders).toNumber(),
        InvPYTD: new Decimal(row.InvPYTD).toNumber(),
        InvPYr: new Decimal(row.InvPYr).toNumber(),
        YTDTotal: new Decimal(row.InvCYTD).add(row.OpenOrders).toNumber(),
        pctChange: new Decimal(row.pctChange).toNumber(),
        CYGoal: new Decimal(row.CYGoal).toNumber(),
        YTDGoalPct: new Decimal(row.YTDGoalPct).toNumber(),
    }
}

export function prepRecentOrderRow(row:RepRecentOrder):RepRecentOrder {
    return {
        ...row,
        OrderDate: dayjs(row.OrderDate).format('MM-DD-YYYY'),
        SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
        CustomerNo: row.ShipToCode
            ? `${[row.ARDivisionNo, row.CustomerNo].join('-')}/${row.ShipToCode}`
            : `${[row.ARDivisionNo, row.CustomerNo].join('-')}`
        ,
        ShipToCity: [row.ShipToCity, row.ShipToState].join(', '),
        InvoiceDate: row.InvoiceDate ? dayjs(row.InvoiceDate).format('MM-DD-YYYY') : null,
        InvoiceTotal: new Decimal(row.InvoiceTotal ?? 0).toNumber(),
    }
}

export function prepOpenOrderRow(row:RepOpenOrder):RepOpenOrder {
    return {
        ...row,
        OrderDate: dayjs(row.OrderDate).format('MM-DD-YYYY'),
        SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
        CustomerNo: row.ShipToCode
            ? `${[row.ARDivisionNo, row.CustomerNo].join('-')}/${row.ShipToCode}`
            : `${[row.ARDivisionNo, row.CustomerNo].join('-')}`
        ,
        ShipToCity: [row.ShipToCity, row.ShipToState].join(', '),
        OrderTotal: new Decimal(row.OrderTotal).toNumber(),
        ShipExpireDate: row.ShipExpireDate ? dayjs(row.ShipExpireDate).format('MM-DD-YYYY') : null,
    }
}

export function prepB2BCart(row:RepOpenCart):RepOpenCart {
    return {
        ...row,
        customerNo: row.shipToCode
            ? `${[row.arDivisionNo, row.customerNo].join('-')}/${row.shipToCode}`
            : `${[row.arDivisionNo, row.customerNo].join('-')}`,
        customerName: row.shipToName ?? row.customerName,
        dateCreated: dayjs(row.dateCreated).format('MM-DD-YYYY'),
        expireDate: dayjs(row.expireDate).format('MM-DD-YYYY'),
        subTotalAmt: new Decimal(row.subTotalAmt).toNumber(),
    }
}

export const accountListColumnNames = (asOfDate:string):ColumnNames<RepAccountWithSales> => {
    const {CYCurrDate, PYMinDate} = getAccountListDates(asOfDate);
    return {
        CustomerNo: 'Customer #',
        CustomerName: 'Customer Name',
        CityStateZip: 'Customer Location',
        InvCYTD: `${dayjs(CYCurrDate).format('YYYY')} YTD`,
        OpenOrders: 'Open Orders',
        YTDTotal: `${dayjs(CYCurrDate).format('YYYY')} Total`,
        InvPYTD: `${dayjs(PYMinDate).format('YYYY')} YTD`,
        InvPYr: `${dayjs(PYMinDate).format('YYYY')} Total`,
        pctChange: `${dayjs(CYCurrDate).format('YYYY')} Growth %`,
        CYGoal: `${dayjs(CYCurrDate).format('YYYY')} Goal`,
        YTDGoalPct: `${dayjs(CYCurrDate).format('YYYY')} Goal %`,
    }
}

export const recentOrdersColumnNames:ColumnNames<RepRecentOrder> = {
    SalesOrderNo: 'S/O #',
    SalespersonNo: 'Rep #',
    OrderDate: 'Order Date',
    B2BOrder: 'B2B Order',
    CustomerNo: 'Customer #',
    BillToName: 'Customer Name',
    ShipToCity: 'Ship To',
    InvoiceNo: 'Invoice #',
    InvoiceDate: 'Invoice Date',
    InvoiceTotal: 'Invoice Total'
}

/**
 *
 * @return {OpenOrder}
 */
export const openOrdersColumnNames:ColumnNames<RepOpenOrder> = {
    SalesOrderNo: 'S/O #',
    SalespersonNo: 'Rep #',
    OrderDate: 'Order Date',
    B2BOrder: 'B2B Order',
    CustomerNo: 'Customer #',
    BillToName: 'Customer Name',
    ShipToCity: 'Ship To',
    ShipExpireDate: 'Ship Date',
    OrderTotal: 'Order Total',
    CancelReasonCodeDesc: 'Notes'
}

const cartsColumnNames:ColumnNames<RepOpenCart> = {
    id: 'Cart #',
    dateCreated: 'Date Created',
    customerNo: 'Customer #',
    customerName: 'Customer Name',
    expireDate: 'Expire Date',
    subTotalAmt: 'Subtotal',
    name: 'Created By'
}


export const getRepAccountsXLSX = async (req:Request, res:Response<unknown, ValidatedUser>) => {
    try {
        const params:AccountListProps = {
            asOfDate: req.params.asOfDate as string,
            salespersonNo: req.params.salespersonNo as string ?? req.query.salespersonNo as string,
            userId: res.locals.profile!.user.id,
        }
        const [accounts, shipTo, recentOrders, openOrders, carts] = await Promise.all([
            loadBillToAccountList(params),
            loadShipToAccountList(params),
            loadRecentOrders(params),
            loadOpenOrders(params),
            loadRepCarts(params),
        ]);
        const asOfDate = dayjs(params.asOfDate ?? new Date()).format('YYYY-MM-DD');

        const billToSheet = resultToExcelSheet(accounts.map(prepBillToAccountRow), accountListColumnNames(asOfDate), true);
        const shipToSheet = resultToExcelSheet(shipTo.map(prepShipToAccountRow), accountListColumnNames(asOfDate), true);
        const recentOrdersSheet = resultToExcelSheet(recentOrders.map(prepRecentOrderRow), recentOrdersColumnNames, true);
        const openOrdersSheet = resultToExcelSheet(openOrders.map(prepOpenOrderRow), openOrdersColumnNames, true);
        const cartOrdersSheet = resultToExcelSheet(carts.map(prepB2BCart), cartsColumnNames, true);
        const sheets = {
            'Bill-To Accounts': billToSheet,
            'Ship-To Accounts': shipToSheet,
            'Recent Orders': recentOrdersSheet,
            'Open Orders': openOrdersSheet,
            'Open B2B Carts': cartOrdersSheet,
        };
        const workbook = await buildWorkBook(sheets, {
            bookType: 'xlsx',
            bookSST: true,
            type: 'buffer',
            compression: true
        });
        const filename = new Date().toISOString();
        res.setHeader('Content-disposition', `attachment; filename=RepAccountList-${filename}.xlsx`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(workbook);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getRepAccountsXLSX()", err.message);
            return Promise.reject(err);
        }
        debug("getRepAccountsXLSX()", err);
        return Promise.reject(new Error('Error in getRepAccountsXLSX()'));
    }
}
