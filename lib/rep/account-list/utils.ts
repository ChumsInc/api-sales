import type {AccountListDates, RepAccountSales, RepSalesGoal} from "./account-list-types.js";
import dayjs from "dayjs";
import {Decimal} from "decimal.js";

export const repGoal = 1.15;

export function getAccountListDates(asOfDate?: string): AccountListDates {
    if (asOfDate && !dayjs(asOfDate).isValid()) {
        throw new Error(`Invalid date: ${asOfDate}`)
    }

    const CYCurrDate = dayjs(asOfDate ?? undefined).format('YYYY-MM-DD');
    const CYMinDate = dayjs(CYCurrDate).format('YYYY-01-01'); //setDayOfYear(CYCurrDate, 1);
    const PYMinDate = dayjs(CYMinDate).add(-1, 'year').format('YYYY-MM-DD'); //addYears(CYMinDate, -1);
    const PYCurrDate = dayjs(CYCurrDate).add(-1, 'year').format('YYYY-MM-DD'); //addYears(CYCurrDate, -1);
    const PYMaxDate = dayjs(PYCurrDate).format('YYYY-12-31');
    return {
        CYCurrDate,
        CYMinDate,
        PYMinDate,
        PYCurrDate,
        PYMaxDate,
    }
}

export function buildAccountListGoal(row: RepAccountSales): RepSalesGoal {
    const YTDTotal = new Decimal(row.InvCYTD).add(row.OpenOrders);
    const pctChange = new Decimal(row.InvPYTD).eq(0)
        ? (YTDTotal.gt(0) ? 1 : 0)
        : new Decimal(YTDTotal).sub(row.InvPYTD).div(new Decimal(row.InvPYTD).abs())
    const CYGoal = new Decimal(row.InvPYr).times(repGoal);
    const YTDGoalPct = new Decimal(row.InvPYr).eq(0)
        ? (YTDTotal.gt(0) ? 1 : 0)
        : new Decimal(new Decimal(row.OpenOrders).add(row.InvCYTD).sub(new Decimal(row.InvPYr).times(repGoal)))
            .div(new Decimal(row.InvPYr).times(repGoal).abs()).toString()
    return {
        ...row,
        YTDTotal: YTDTotal.toString(),
        pctChange: pctChange.toString(),
        CYGoal: CYGoal.toString(),
        YTDGoalPct: YTDGoalPct.toString(),
    }
}
