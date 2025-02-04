import {RowDataPacket} from "mysql2";

export interface ChangedRowResponse {
    affectedRows: number;
    remaining: number;
}

export type RemainingRowsResponse = RowDataPacket & {
    remaining: number;
}
export interface TableHandlerResponse extends ChangedRowResponse {
    table: string;
    duration?: number;
}

export interface TableHandlerOptions {
    dryRun?: boolean;
    deferLogging?: boolean;
}
export type TableHandler = (userId: number, table: string, from:string, to:string, options: TableHandlerOptions) => Promise<TableHandlerResponse>;

export interface TableDefinition {
    table: string;
    handler?: TableHandler;
}
export interface CustomerKey {
    arDivisionNo: string;
    customerNo: string;
}

export interface ValidateCustomerResponse {
    ARDivisionNo:string;
    CustomerNo:string;
    CustomerName: string;
    CustomerStatus: string;
    InactiveReasonCode: string|null
}

export type ValidateCustomerRow = ValidateCustomerResponse & RowDataPacket;

export interface ErrorResponse {
    name: string;
    message: string;
    stack?: string;
}
