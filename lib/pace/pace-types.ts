import {Decimal} from "decimal.js";

export interface PaceBudgetRow {
    BudgetCode: string;
    Account:string;
    Amt: string|number|Decimal;
}

export interface PaceBudgetList {
    [key:string]: {
        ORIGINAL: string|number|Decimal;
        REVISED: string|number|Decimal;
    }
}

export interface DivisionPaceRow {
    ARDivisionNo: string;
    ARDivisionDesc: string;
    Year: string|number;
    Month: string|number;
    budget: string|number|Decimal;
    goal: string|number|Decimal;
    InvoiceTotal: string|number|Decimal;
    CurrentInvoiceTotal: string|number|Decimal;
    PrevOpenOrderTotal: string|number|Decimal;
    OpenOrderTotal: string|number|Decimal;
    HeldOpenOrderTotal: string|number|Decimal;
}
