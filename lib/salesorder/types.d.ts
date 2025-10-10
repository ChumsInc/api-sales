export interface LoadOrdersParams {
    user_id: number;
    company: string;
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
