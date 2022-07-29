export interface LoadOrdersParams {
    user_id: number;
    company: string;
    ARDivisionNo:string;
    CustomerNo: string;
    limit?: number|string;
    offset?: number|string;
}
