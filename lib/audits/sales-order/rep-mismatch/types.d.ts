import {RowDataPacket} from "mysql2";

export interface RepMismatchRecord {
    ARDivisionNo: string;
    CustomerNo: string;
    CustomerName: string;
    ShipToCode: string | null;
    ShipToName: string | null;
    CustomerRep: string | null;
    SalespersonName: string | null;
    SalesOrderNo: string;
    OrderType: string;
    OrderDate: string;
    ShipExpireDate: string;
    SalesOrderRep: string | null;
    SalesOrderRepName: string | null;
}

export type RepMismatchRow = RepMismatchRecord & RowDataPacket;
