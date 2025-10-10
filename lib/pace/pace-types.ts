import {Decimal} from "decimal.js";

export interface PaceBudgetRow {
    BudgetCode: string;
    Account: string;
    Amt: string | number | Decimal;
}

export interface PaceBudgetList {
    [key: string]: {
        ORIGINAL: string | number | Decimal;
        REVISED: string | number | Decimal;
    }
}

export interface PaceDivisionRow {
    ARDivisionNo: string;
    ARDivisionDesc: string;
    budget: string | number | Decimal;
    goal: string | number | Decimal;
    InvoiceTotal: string | number | Decimal;
    PrevOpenOrderTotal: string | number | Decimal;
    OpenOrderTotal: string | number | Decimal;
    HeldOpenOrderTotal: string | number | Decimal;
    Pace: string | number | Decimal;
}

export interface PaceParams {
    year: string | number;
    month: string | number;
}
export interface PaceDivisionParams extends PaceParams{
    ARDivisionNo: string;
}

export interface PaceDates {
    minDate: string;
    maxDate: string;
}

export interface PaceSegmentRow extends Omit<PaceDivisionRow, 'ARDivisionDesc'|'goal'|'budget'> {
    Segment: string;
    Description: string|null;
    Customers: number|string;
}

export interface PaceCustomerRow extends Omit<PaceDivisionRow, 'ARDivisionDesc'|'goal'|'budget'> {
    CustomerNo: string;
    CustomerName: string;
}
