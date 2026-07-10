import type {RowDataPacket} from "mysql2";

export interface SalespersonRow {
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    SalespersonName: string;
    EmailAddress?: string|null;
    Active?: boolean;
    manager?: SalespersonRow|null;
    total: RepTotal;
}
export interface RepPaceFields {
    OpenOrders: string|number;
    InvCYTD: string|number;
    InvPYTD: string|number;
    InvPY: string|number;
    InvP2TD: string|number;
    InvP2: string|number;
    rate: string|number;
    pace: string|number;
}

export interface CustomerRow extends RepPaceFields {
    ARDivisionNo: string;
    CustomerNo: string;
    ShipToCode: string|null;
    CustomerName: string;
    EmailAddress: string|null;
}

export type RepTotal = RepPaceFields;

export interface LoadRepProps {
    SalespersonDivisionNo?: string|null;
    SalespersonNo?: string|null;
    userid: number;
}

export interface LoadRepPaceProps extends LoadRepProps {
    minDate: string;
    maxDate: string;
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

export interface ExcelRepFields extends RepPaceFields {
    account: string;
    name: string;
    email: string|null;
}

export interface ExcelSubRepFields extends RepPaceFields {
    Salesperson: string;
    SalespersonName: string;
    EmailAddress?: string;
}

export interface ExcelCustomerFields extends RepPaceFields {
    account: string;
    name: string;
    email: string|null;
}

export interface RepPaceTotals {
    OpenTotal: string|number|null;
    InvCYTD: string|number|null;
    InvCY: string|number|null;
    InvPYTD: string|number|null;
    InvPY: string|number|null;
    InvP2TD: string|number|null;
    InvP2: string|number|null;
    rate: string|number;
    pace: string|number;
    count: number|string|null;
}
export type RawRepPaceTotals = Omit<RepPaceTotals, 'rate'|'pace'>;
export type CustomerPaceTotals = Omit<RepPaceTotals, 'count'>;
export type RawCustomerPaceTotals = Omit<CustomerPaceTotals, 'rate'|'pace'>;

export interface RepPaceRecord {
    SalesManagerCode: string|null;
    SalespersonCode: string;
    SalespersonName: string;
    Level: number;
    totals: RepPaceTotals;
}

export type RepPaceRow = Omit<RepPaceRecord, 'totals'> & RawRepPaceTotals & RowDataPacket;

export interface RepPaceRollup extends RepPaceRecord {
    subReps: Record<string, RepPaceRollup>|null;
    subRepTotals: RepPaceTotals|null;
}

export type RepPaceRollupRecord = Record<string, RepPaceRollup>;

export interface SalesRep {
    SalespersonCode: string;
    SalesManagerCode: string;
    SalespersonName: string;
}

export interface CustomerPaceRecord {
    CustomerCode: string;
    CustomerName: string;
    EmailAddress: string|null;
    totals: CustomerPaceTotals;
}
export type CustomerPaceRow = Omit<CustomerPaceRecord, 'totals'> & RawCustomerPaceTotals & RowDataPacket;
