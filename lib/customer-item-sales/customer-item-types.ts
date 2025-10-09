export interface CustomerItemSales {
    QuantitySold: number | string;
    DollarsSold: number | string;
}

export type CustomerItemSalesPeriodList = Record<string, CustomerItemSales>;

export interface CustomerItemSalesRow {
    ARDivisionNo: string;
    CustomerNo: string;
    CustomerName: string;
    ShipToCode: string;
    ShipToName: string;
    ItemCode: string;
    ItemCodeDesc: string;
    FiscalCalYear: string;
    FiscalCalPeriod: string;
    QuantitySold: number | string;
    DollarsSold: number | string;
}

export interface CustomerItemSalesRecord extends Omit<CustomerItemSalesRow, 'FiscalCalPeriod'> {
    periods: CustomerItemSalesPeriodList;
}


export interface CustomerInfo {
    customerNo: string;
    customerName: string;
}

export interface CustomerItemSalesPeriods {
    DollarsSold01: number;
    DollarsSold02: number;
    DollarsSold03: number;
    DollarsSold04: number;
    DollarsSold05: number;
    DollarsSold06: number;
    DollarsSold07: number;
    DollarsSold08: number;
    DollarsSold09: number;
    DollarsSold10: number;
    DollarsSold11: number;
    DollarsSold12: number;
}

export interface CustomerItemQtyPeriods {
    QuantitySold01: number;
    QuantitySold02: number;
    QuantitySold03: number;
    QuantitySold04: number;
    QuantitySold05: number;
    QuantitySold06: number;
    QuantitySold07: number;
    QuantitySold08: number;
    QuantitySold09: number;
    QuantitySold10: number;
    QuantitySold11: number;
    QuantitySold12: number;
}

export type CustomerItemSalesData =
    CustomerInfo
    & Omit<CustomerItemSalesRecord, 'periods' | 'ARDivisionNo' | 'CustomerNo' | 'ShipToCode' | 'CustomerName' | 'ShipToName'>
    & CustomerItemSalesPeriods;
export type CustomerItemQtyData =
    CustomerInfo
    & Omit<CustomerItemSalesRecord, 'periods' | 'ARDivisionNo' | 'CustomerNo' | 'ShipToCode' | 'CustomerName' | 'ShipToName'>
    & CustomerItemQtyPeriods;
