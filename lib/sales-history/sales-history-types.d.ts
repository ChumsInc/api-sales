import {RowDataPacket} from "mysql2";

export interface MonthHistory {
    month: string;
    year0: number|string|null;
    year1: number|string|null;
    year2: number|string|null;
}

export type MonthHistoryRow = MonthHistory & RowDataPacket;

export interface MonthOpenTotal {
    month: string;
    openTotal: number|string;
}

export type MonthOpenTotalRow = MonthOpenTotal & RowDataPacket;
