import Debug from "debug";
import Decimal from "decimal.js";
import {resultToExcelSheet, ColumnNames, buildWorkBook, type WorkBookSheets} from 'chums-local-modules'
import type {CustomerItemQtyData, CustomerItemSalesData, CustomerItemSalesRecord} from "./customer-item-types.js";

const debug = Debug('chums:lib:customer-item-sales:excel-handler');

const fiscalPeriods = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const dollarSoldColumns:ColumnNames<Omit<CustomerItemSalesData, 'QuantitySold'>> = {
    customerNo: 'Customer No',
    customerName: 'Name',
    ItemCode: 'Item Code',
    ItemCodeDesc: 'Item Description',
    FiscalCalYear: 'Year',
    DollarsSold01: 'Jan',
    DollarsSold02: 'Feb',
    DollarsSold03: 'Mar',
    DollarsSold04: 'Apr',
    DollarsSold05: 'May',
    DollarsSold06: 'Jun',
    DollarsSold07: 'Jul',
    DollarsSold08: 'Aug',
    DollarsSold09: 'Sep',
    DollarsSold10: 'Oct',
    DollarsSold11: 'Nov',
    DollarsSold12: 'Dec',
    DollarsSold: 'Total',
    
}
const qtySoldColumns:ColumnNames<Omit<CustomerItemQtyData, 'DollarsSold'>> = {
    customerNo: 'Customer No',
    customerName: 'Name',
    ItemCode: 'Item Code',
    ItemCodeDesc: 'Item Description',
    FiscalCalYear: 'Year',
    QuantitySold01: 'Jan',
    QuantitySold02: 'Feb',
    QuantitySold03: 'Mar',
    QuantitySold04: 'Apr',
    QuantitySold05: 'May',
    QuantitySold06: 'Jun',
    QuantitySold07: 'Jul',
    QuantitySold08: 'Aug',
    QuantitySold09: 'Sep',
    QuantitySold10: 'Oct',
    QuantitySold11: 'Nov',
    QuantitySold12: 'Dec',
    QuantitySold: 'Total',
}

export function buildCustomerItemsData(data:CustomerItemSalesRecord[]):(CustomerItemSalesData & CustomerItemQtyData)[] {
    return data.map(row => {
        const {periods, ARDivisionNo, CustomerNo, ShipToCode, CustomerName, ShipToName, ...rest} = row;
        const excelRow:Partial<CustomerItemSalesData & CustomerItemQtyData> = {
            customerNo: ShipToCode ? `${ARDivisionNo}-${CustomerNo}-${ShipToCode}` : `${ARDivisionNo}-${CustomerNo}`,
            customerName: ShipToName ? ShipToName : CustomerName,
            ...rest
        }
        fiscalPeriods.forEach((period) => {
            // @ts-ignore
            excelRow[`QuantitySold${period}`] = new Decimal(row.periods[period]?.QuantitySold ?? 0 ).toNumber();
            // @ts-ignore
            excelRow[`DollarsSold${period}`] = new Decimal(row.periods[period]?.DollarsSold ?? 0 ).toNumber();
        })
        return excelRow;
    }) as (CustomerItemSalesData & CustomerItemQtyData)[];
}

export async function buildCustomerItemsExcel(data: CustomerItemSalesRecord[]):Promise<string|null> {
    try {
        const rows = buildCustomerItemsData(data);
        const sheet1 = resultToExcelSheet(rows, dollarSoldColumns, true);
        const sheet2 = resultToExcelSheet(rows, qtySoldColumns, true);
        const workBookSheets:WorkBookSheets = {
            'Customer Item Sales': sheet1,
            'Customer Item Qty': sheet2,
        }
        return buildWorkBook(workBookSheets) as string ?? null;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("buildCustomerItemsExcel()", err.message);
            return Promise.reject(err);
        }
        debug("buildCustomerItemsExcel()", err);
        return Promise.reject(new Error('Error in buildCustomerItemsExcel()'));
    }
}
