export interface SalespersonRow {
    Company: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    SalespersonName: string;
    EmailAddress?: string|null;
    Active?: boolean;
    manager?: SalespersonRow|null;
    total: RepTotal;
}

export interface CustomerRow {
    Company: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode: string;
    CustomerName: string;
    EmailAddress: string|null;
    OpenOrders: string|number;
    InvCYTD: string|number;
    InvPYTD: string|number;
    InvPY: string|number;
    InvP2TD: string|number;
    InvP2: string|number;
    rate: string|number;
    pace: string|number;
}

export interface RepTotal {
    OpenOrders: string|number;
    InvCYTD: string|number;
    InvPYTD: string|number;
    InvPY: string|number;
    InvP2TD: string|number;
    InvP2: string|number;
    rate: string|number;
    pace: string|number;
}

export interface LoadRepProps {
    Company: string;
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    userid?: number;
}

export interface LoadRepPaceProps extends LoadRepProps {
    minDate: string;
    maxDate: string;
    userid?: number;
    groupByCustomer?: boolean;
}

export interface RepPace {
    userid: number;
    rep: SalespersonRow;
    repSubReps: (RepPace|null)[];
    repCustomers: CustomerRow[];
}

export type ExcelRepRow  = RepTotal & {
    Salesperson: string;
    SalespersonName: string;
    EmailAddress?: string;
};

export interface ExcelStandardColumnList {
    OpenOrders: string;
    InvCYTD: string;
    InvPYTD: string;
    InvPY: string;
    InvP2TD: string;
    InvP2: string;
    rate: string;
    pace: string;
}

export interface KeyedHeaderObject {
    [key:string]: string;
}
