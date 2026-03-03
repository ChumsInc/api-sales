import type {Request, Response} from "express";
import type {ValidatedUser} from "chums-local-modules";
import Debug from "debug";
import {loadRepBillToTotal} from "./rep-bill-to-total.js";
import type {AccountListProps} from "./account-list-types.js";
import {loadRepShipToTotal} from "./rep-ship-to-total.js";
import {loadBillToAccountList} from "./bill-to-account-list.js";
import {loadShipToAccountList} from "./ship-to-account-list.js";
import {loadRepCarts} from "./rep-carts.js";
import {loadRecentOrders} from "./rep-recent-orders.js";
import {loadOpenOrders} from "./rep-open-orders.js";

const debug = Debug('chums:lib:rep:account-list:request-handlers');

export async function getRepTotals(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        const params:Omit<AccountListProps, 'salespersonNo'> = {
            userId: res.locals.profile!.user.id,
            asOfDate: req.params.asOfDate as string ?? req.query.asOfDate as string,
        }
        const [reps, shipToReps] = await Promise.all([
            loadRepBillToTotal(params),
            loadRepShipToTotal(params),
        ])
        res.json({reps, shipToReps});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getRepTotals()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getRepTotals'});
    }
}

export async function getRepAccounts(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        const params:AccountListProps = {
            userId: res.locals.profile!.user.id,
            salespersonNo: req.params.SalespersonNo as string ?? req.query.SalespersonNo as string,
            asOfDate: req.params.asOfDate as string ?? req.query.asOfDate as string,
        }
        const [accounts, shipTo, recentOrders, openOrders, carts] = await Promise.all([
            loadBillToAccountList(params),
            loadShipToAccountList(params),
            loadRecentOrders(params),
            loadOpenOrders(params),
            loadRepCarts(params)
        ])
        res.json({accounts, shipTo, recentOrders, openOrders, carts});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getRepAccounts()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getRepAccounts'});
    }
}

export async function getOpenRepOrders(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        const orders = await loadOpenOrders({
            userId: res.locals.profile!.user.id,
            salespersonNo: req.params.SalespersonNo as string ?? req.query.SalespersonNo as string,
        })
        res.json({orders});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getOpenRepOrders()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getOpenRepOrders'});
    }
}

export async function getRepOrders(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        const params:Omit<AccountListProps, 'salespersonNo'> = {
            userId: res.locals.profile!.user.id,
            asOfDate: req.params.asOfDate as string ?? req.query.asOfDate as string,
        }
        const [recentOrders, openOrders] = await Promise.all([
            loadRecentOrders(params),
            loadOpenOrders(params),
        ])
        res.json({recentOrders, openOrders});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getRepOrders()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getRepOrders'});
    }
}
