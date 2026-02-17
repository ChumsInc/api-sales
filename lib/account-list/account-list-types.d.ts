export type AccountListDataField = 'account'
    |'CustomerName'|'CustomerAddress'|'City'|'State'|'ZipCode'|'CountryCode'
    | 'SalespersonNo' | 'SalespersonName' | 'CustomerType' | 'PriceLevel' | 'TelephoneNo' | 'EmailAddress' 
    | 'DateCreated' | 'DateLastActivity';

export type AccountListSalesField = 'SalesP1' | 'SalesP2' | 'SalesP3' | 'SalesP4' | 'SalesP5';

export type AccountListField = AccountListDataField | AccountListSalesField;

export interface ALCustomer {
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode: string;
    account: string;
    isB2B: boolean;
    CustomerName: string|null;
    AddressLine1: string|null;
    AddressLine2: string|null;
    AddressLine3: string|null;
    City: string|null;
    State: string|null;
    ZipCode: string|null;
    CountryCode: string|null;
    TelephoneNo: string|null;
    FaxNo: string|null;
    EmailAddress: string|null;
    SalespersonNo: string;
    SalespersonName: string|null;
    DateCreated: string|null;
    CustomerType: string|null;
    CustomerStatus: string|null;
    PriceLevel: string|null;
    DateLastActivity: string|null;
    SalesP1: string|number;
    SalesP2: string|number;
    SalesP3: string|number;
    SalesP4: string|number;
    SalesP5: string|number;
}


export interface AccountListFilters {
    userId: number|string;
    ARDivisionNo?: string|null;
    CustomerNo?: string|null;
    SalespersonNo: string;
    SalespersonDivisionNo?:string|null;
    State?: string|null;
    CountryCode?: string|null;
    CustomerType?: string|null;
    includeInactive?: string|null;
    DateCreatedMin?: string|null;
    DateCreatedMax?: string|null;
    DateLastActivityMin?: string|null;
    DateLastActivityMax?: string|null;
    SalesP1?: string|number|null;
    SalesP2?: string|number|null;
    SalesP3?: string|number|null;
    SalesP4?: string|number|null;
    SalesP5?: string|number|null;
    top?: string|number|null;
}

export interface AccountListSalesPeriods {
    p1MinDate?: string|null;
    p1MaxDate?: string|null;
    p2MinDate?: string|null;
    p2MaxDate?: string|null;
    p3MinDate?: string|null;
    p3MaxDate?: string|null;
    p4MinDate?: string|null;
    p4MaxDate?: string|null;
    p5MinDate?: string|null;
    p5MaxDate?: string|null;
}

export interface AccountListTotals {
    SalesP1: number|string;
    SalesP2: number|string;
    SalesP3: number|string;
    SalesP4: number|string;
    SalesP5: number|string;
}

export interface LoadAccountResult {
    rows: ALCustomer[];
    totals: AccountListTotals;
    query: string;
    params: AccountListFilters & AccountListSalesPeriods;
}

export interface AccountListSort {
    field: AccountListField;
    asc: boolean;
}

export interface AccountListBody {
    fields: AccountListField[];
    filters: AccountListFilters;
    periods: AccountListSalesPeriods;
    sort: AccountListSort[]
}

export interface ParsedBody {
    fields: AccountListField[];
    filters: AccountListFilters;
    periods: AccountListSalesPeriods;
    sqlSort: string;
}

export interface SalesP1TitleProps {
    p1MinDate?: string|null;
    p1MaxDate?: string|null;
}
export interface SalesP2TitleProps {
    p2MinDate?: string|null;
    p2MaxDate?: string|null;
}
export interface SalesP3TitleProps {
    p3MinDate?: string|null;
    p3MaxDate?: string|null;
}
export interface SalesP4TitleProps {
    p4MinDate?: string|null;
    p4MaxDate?: string|null;
}
export interface SalesP5TitleProps {
    p5MinDate?: string|null;
    p5MaxDate?: string|null;
}

export interface AccountListDataTitles extends Record<AccountListDataField, () => string> {
    ARDivisionNo: () => string;
    CustomerNo: () => string;
    ShipToCode: () => string;
    AddressLine1: () => string;
    AddressLine2: () => string;
    AddressLine3: () => string;
    account: () => string;
}


export type AccountListPeriodTitles = Record<AccountListSalesField, (props: AccountListSalesPeriods) => string>

export interface AccountListTitles {
    dataTitles: AccountListDataTitles;
    periodTitles: AccountListPeriodTitles;
}

export interface LoadAccountProps {
    filters: AccountListFilters;
    periods: AccountListSalesPeriods;
    sqlSort: string;
}

export type AccountRow = RowDataPacket & ALCustomer;
