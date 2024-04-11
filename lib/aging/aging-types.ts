export interface CustomerAging {
    ARDivisionNo: string;
    CustomerNo: string;
    CustomerName: string;
    TermsCodeDesc: string;
    CurrentBalance: number|string;
    AgingCategory1: number|string;
    AgingCategory2: number|string;
    AgingCategory3: number|string;
    AgingCategory4: number|string;
    OpenOrderAmt: number|string;
    TotalDue?: number|string;
}

export interface RepAgingTotal {
    SalespersonDivisionNo: string;
    SalespersonNo: string;
    SalespersonName: string;
    accounts: number;
    CurrentBalance: number|string;
    AgingCategory1: number|string;
    AgingCategory2: number|string;
    AgingCategory3: number|string;
    AgingCategory4: number|string;
    OpenOrderAmt: number|string;
    TotalDue?: number|string;
}
