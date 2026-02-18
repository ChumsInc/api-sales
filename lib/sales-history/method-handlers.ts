import Debug from "debug";
import {Request, Response} from "express";
import {ValidatedUserProfile} from "chums-types";
import {loadMonthHistory, loadMonthOpen} from "./db-handlers.js";
import {loadCompanyGoal} from "../goal/index.js";

const debug = Debug('chums:lib:sales-history:method-handlers');

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export async function getMonthsTotals(req: Request<unknown, ValidatedUserProfile>, res: Response): Promise<void> {
    try {
        const monthHistory = await loadMonthHistory(res.locals.profile?.user?.id ?? 0);
        res.json(monthHistory);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getMonthsSales()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getMonthsSales'});
    }
}

export async function getMonthOpenTotals(req: Request<unknown, ValidatedUserProfile>, res: Response): Promise<void> {
    try {
        const monthHistory = await loadMonthOpen(res.locals.profile?.user?.id ?? 0);
        res.json(monthHistory);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getMonthOpenTotals()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getMonthOpenTotals'});
    }
}

export async function getHistoryGraphTotals(req: Request<unknown, ValidatedUserProfile>, res: Response): Promise<void> {
    const userId = res.locals.profile?.user?.id ?? 0;
    const [goalBudget, history, openOrders] = await Promise.all(
        [loadCompanyGoal(), loadMonthHistory(userId), loadMonthOpen(userId)]
    )

    const response = months.map(month => {
        const goal = goalBudget.find(row => row.FiscalPeriod === month);
        const monthHistory = history.find(row => row.month === month);
        const open = openOrders.find(row => row.month === month);
        return {
            month,
            year0: +(monthHistory?.year0 ?? '0'),
            year1: +(monthHistory?.year1 ?? '0'),
            year2: +(monthHistory?.year2 ?? '0'),
            openTotal: +(open?.openTotal ?? '0'),
            goal: +(goal?.goal ?? '0'),
        }
    });
    const maxAge = 6 * 60 * 60; // 6 hours
    res.set('Cache-Control', `no-cache, no-store, must-revalidate, private, max-age=${maxAge}`);
    res.json(response);
}
