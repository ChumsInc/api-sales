import {ParseSQLParams} from "chums-local-modules";
import {RowDataPacket} from "mysql2";

export interface SAParams extends ParseSQLParams {
    ARDivisionNo: string|null;
    BaseSKU: string|null;
    Category2: string|null;
    Category3: string|null;
    CostAccount: string|null;
    CountryOfOrigin: string|null;
    CustomerNo: string|null;
    CustomerType: string|null;
    CustomerGroup: string|null;
    ItemCode: string|null;
    PrimaryVendorNo: string|null;
    ProductLine: string|null;
    ProductStatus: string|null;
    SalesAccount: string|null;
    SalespersonNo: string|null;
    ShipToCode: string|null;
    ShipToState: string|null;
    SortField: string[];
    State: string|null;
    discounts: string;
    limit: number;
    minCreatedDate: string|null;
    maxCreatedDate: string|null;
    method: string;
    openOrders: string;
    p1max: string;
    p1min: string;
    p2max: string;
    p2min: string;
}

export type SACombineOptions = Partial<Pick<SAParams, 'SortField'|'discounts'|'openOrders'|'method'>>;


export interface SADivisionRow {
    ARDivisionNo: string;
    ARDivisionDesc: string;
}

export interface SACustomerRow {
    ARDivisionNo: string;
    CustomerNo: string;
    CustomerName: string;
}

export interface SAShipToRow extends SACustomerRow {
    ShipToCode: string;
    ShipToName: string;
}

export interface SALocationRow {
    CountryCode: string|null;
    CountryName: string|null;
    StateCode: string|null;
    StateName: string|null;
}

export interface SAMonthRow {
    MonthName: string;
}

export interface SASalesRepRow {
    SalespersonName: string|null;
}

export interface SADescribedRow {
    description: string|null;
}

export interface SAGLRow {
    AccountDesc: string|null;
}
export interface SAProductLineRow {
    ProductLineDesc: string|null;
}

export interface SAVendorRow {
    VendorName: string|null;
}

export interface SAItemRow {
    ItemCodeDesc: string|null;
    ProductStatus: string|null;
}

export interface SASelfDescribedRow {
    key_field: string;
}

export type SASectionRow = SADivisionRow|SACustomerRow|SAShipToRow|SALocationRow|SAMonthRow|SASalesRepRow|SADescribedRow|SAGLRow|SAProductLineRow|SAVendorRow|SAItemRow|SASelfDescribedRow;

export interface SABaseRow {
    key_field: string;
    p1_shipped: number|string|Decimal;
    p1_sales: number|string|Decimal;
    p1_cogs: number|string|Decimal;
    p1_revenue: number|string|Decimal;
    p1_margin: number|string|Decimal;
    p2_shipped: number|string|Decimal;
    p2_sales: number|string|Decimal;
    p2_cogs: number|string|Decimal;
    p2_revenue: number|string|Decimal;
    p2_margin: number|string|Decimal;
    c_growth?: number|string|Decimal;
    c_sales?: number|string|Decimal;
    c_rate?: number|string|Decimal;
    c_percent?: number|string|Decimal;
}

export type SARow<T = SASectionRow> = SABaseRow & T & RowDataPacket;

export interface SARequestParams extends SAParams {
    company: string;
    created_min?: string;
    created_max?: string;
    countryOfOrigin?: string;
    'include-open-orders': string;
    'include-discounts': string;
    sort: string;
    strictFilter: string;
}

export type SAQueryFunction = (options:SACombineOptions) => string;

export interface SAQueryResult<T = SASectionRow> {
    query: string;
    rows: SARow<T>[];
    error?: string;
}
