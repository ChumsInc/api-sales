export interface LoadOrdersParams {
    user_id: number;
    ARDivisionNo:string;
    CustomerNo: string;
    limit?: number|string;
    offset?: number|string;
}

export interface OrdersByPeriodRecord {
    SalesOrderNo: string;
    OrderDate: string;
    OrderType: string;
    CancelReasonCode: string|null;
    CancelReasonCodeDesc: string|null;
    ShipExpireDate: string|null;
    UDF_IMPRINTED: string|null;
    ARDivisionNo: string;
    CustomerNo: string;
    BillToName: string|null;
    BillToCity: string|null;
    BillToState: string|null;
    BillToCountryCode: string|null;
    ShipToCode: string|null;
    ShipToName: string|null;
    ShipToCity: string|null;
    ShipToState: string|null;
    ShipToCountryCode: string|null;
    CurrentInvoiceNo: string|null;
    OrderTotal: string|number;
    LastInvoiceNo: string|null;
    LastInvoiceDate: string|null;
    SalespersonDivisionNo: string|null;
    SalespersonNo: string|null;
    CreatedByUser: string|null;
    UpdatedByUser: string|null;
    OrderWeek: string|number;
    ShipWeek: string|number;
    week: number;
    day: number;
}

export interface AccountOpenOrder {
    Company: string;
    SalesOrderNo: string;
    ARDivisionNo: string;
    ShipExpireDate: string|null;
    CustomerPONo: string|null;
    CustomerNo: string;
    BillToName: string|null;
    OrderDate: string;
    OrderType: string;
    OrderStatus: string;
    ShipToCode: string|null;
    ShipToName: string|null;
    ShipToCity: string|null;
    ShipToState: string|null;
    TaxableAmt: number|string;
    NonTaxableAmt: number|string;
    DiscountAmt: number|string;
    SalesTaxAmt: number|string;
    FreightAmt: number|string;
    LastInvoiceNo: string|null;
    Imprinted: string|null;
    UDF_CANCEL_DATE: string|null;
    CancelReasonCode: string|null;
}

export interface AccountClosedOrder extends Omit<AccountOpenOrder, 'ShipExpireDate'|'OrderType'|'Imprinted'|'UDF_CANCEL_DATE'> {
    LastInvoiceDate: string|null;
}
