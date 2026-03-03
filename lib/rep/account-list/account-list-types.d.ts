export interface AccountListDates {
    CYCurrDate: string,
    CYMinDate: string,
    PYMinDate: string,
    PYCurrDate: string,
    PYMaxDate: string,
}
export interface AccountListData {
    Customers: number,
    InvCYTD: number|string,
    OpenOrders: number|string,
    InvPYTD: number|string,
    InvPYr: number|string,
    YTDTotal: number|string,
    pctChange: number|string,
    CYGoal: number|string,
    YTDGoalPct: number|string
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


export interface RepOpenCart {
    id: number;
    salesOrderNo: string|null;
    dateCreated: string;
    dateUpdated: string;
    arDivisionNo: string;
    customerNo: string;
    customerName: string;
    shipToCode: string|null;
    shipToName: string|null;
    expireDate: string;
    subTotalAmt: number|string;
    comment: string|null;
    email: string|null;
    name: string|null;
    accountType: number|null;
}

export interface RepRecentOrder {
    SalesOrderNo: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    OrderDate: string;
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode: string|null;
    BillToName: string;
    ShipToCity: string|null;
    ShipToState: string|null;
    ShipToCountryCode: string|null;
    InvoiceNo: string|null;
    InvoiceDate: string|null;
    InvoiceTotal: number|string|null;
    Imprinted: string;
    B2BOrder: string;
}

export interface RepOpenOrder {
    SalesOrderNo: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    OrderDate: string;
    OrderStatus: string;
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode: string|null;
    BillToName: string;
    ShipToCity: string|null;
    ShipToState: string|null;
    ShipToCountryCode: string|null;
    OrderTotal: number|string;
    LastInvoiceNo: string|null;
    ShipExpireDate: string|null;
    CancelReasonCode: string|null;
    CancelReasonCodeDesc: string|null;
    Imprinted: string;
    B2BOrder: string;
}

export interface RepAccountListTotal {
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    SalespersonName: string;
    TerminatedRep: string;
    Customers: number;
    InvCYTD: number|string;
    OpenOrders: number|string;
    InvPYTD: number|string;
    InvPYr: number|string;
    YTDTotal: number|string;
    pctChange: number|string;
    CYGoal: number|string;
    YTDGoalPct: number|string
}

export interface RepAccountWithSales {
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode?: string|null;
    CustomerName: string;
    ShipToName?: string|null;
    CityStateZip: string;
    ZipCode: string|null;
    DateLastActivity: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    SalespersonName: string;
    InvCYTD: number|string;
    OpenOrders: number|string;
    InvPYTD: number|string;
    InvPYr: number|string;
    YTDTotal: number|string;
    pctChange: number|string;
    CYGoal: number|string;
    YTDGoalPct: number|string;
}

export interface RepAccountSales {
    InvCYTD: number|string;
    OpenOrders: number|string;
    InvPYTD: number|string;
    InvPYr: number|string;
}

export interface RepSalesGoal {
    YTDTotal: number|string;
    pctChange: number|string;
    CYGoal: number|string;
    YTDGoalPct: number|string;
}

export interface AccountListProps {
    userId: number;
    salespersonNo: string;
    asOfDate?: string;
}
