export interface AccountListData {
    Customers?: number,
    InvCYTD: number,
    OpenOrders: number,
    InvPYTD: number,
    InvPYr: number,
    YTDTotal: number,
    pctChange: number,
    CYGoal: number,
    YTDGoalPct: number
}

export interface SalesRepBase {
    SalespersonDivisionNo: string,
    SalespersonNo: string,
}

export interface SalesRep extends AccountListData, SalesRepBase {
    SalespersonName: string
    TerminatedRep: 'Y'|'N',
    Customers: number,
}

export interface CustomerBase {
    ARDivisionNo: string,
    CustomerNo: string,
    CustomerName: string,
}

export interface BillToCustomer extends AccountListData, CustomerBase, SalesRepBase {
    CityStateZip: string,
    DateLastActivity: string,
    SalespersonName: string,
}

export interface ShipToCustomer extends AccountListData, CustomerBase, SalesRepBase {
    ShipToCode: string,
    ShipToName: string,
    CityStateZip?: string,
    SalespersonName: string,
    ShipToCity?: string,
    ShipToState?: string,
    ShipToCountryCode?: string,
}

export interface OrderBase extends SalesRepBase, CustomerBase, ShipToCustomer{
    SalesOrderNo: string,
    OrderDate: string,
    OrderStatus: string,
    BillToName: string,
    Imprinted: string,
    B2BOrder: string,
}

export interface RecentOrder extends OrderBase {
    InvoiceNo: string,
    InvoiceDate: string,
    InvoiceTotal: number,
}

export interface OpenOrder extends OrderBase {
    OrderType: string,
    OrderTotal: number,
    ShipExpireDate: string,
    CancelReasonCode: string|null,
    CancelReasonCodeDesc: string|null,
}
