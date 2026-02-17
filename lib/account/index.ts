import Debug from 'debug';
import {loadAccountInvoices, loadYearInvoiceCount} from "./invoices.js";
import {loadMissingTaxSchedules} from "./missing-tax-shedule.js";
import {Request, Response} from "express";
import {ValidatedUserProfile} from "chums-types";
import dayjs from "dayjs";

const debug = Debug('chums:lib:account');


export async function renderMissingTaxSchedules(req: Request, res: Response): Promise<void> {
    try {
        const accounts = await loadMissingTaxSchedules();
        if (!accounts || accounts.length === 0) {
            res.status(301).send();
            return;
        }
        res.render('./sales/missing-tax-schedule.pug', {accounts});
    } catch (err) {
        if (err instanceof Error) {
            debug("renderMissingTaxSchedules()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in renderMissingTaxSchedules'});
    }
}

export async function getMissingTaxSchedules(req: Request, res: Response):Promise<void> {
    try {
        const accounts = await loadMissingTaxSchedules();
        res.json({accounts});

    } catch (err) {
        if (err instanceof Error) {
            debug("getMissingTaxSchedules()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getMissingTaxSchedules'});
    }
}

export async function getAccountInvoices(req: Request, res: Response<unknown, ValidatedUserProfile>):Promise<void> {
    try {
        const params = {
            user_id: res.locals.profile!.user.id,
            Company: req.params.Company as string,
            ARDivisionNo: req.params.ARDivisionNo as string,
            CustomerNo: req.params.CustomerNo as string,
            year: req.query.year as string ?? dayjs().format('YYYY'),
            offset: req.query.offset as string || 0,
            limit: req.query.limit as string || 1000
        };
        const result = await loadAccountInvoices(params);
        res.json({result});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getAccountInvoices()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getAccountInvoices'});
    }
}

export async function getAccountInvoiceCount(req: Request, res: Response):Promise<void> {
    try {
        const params = {
            user_id: res.locals.profile!.user.id,
            ARDivisionNo: req.params.ARDivisionNo as string,
            CustomerNo: req.params.CustomerNo as string,
        };
        const invoices = await loadYearInvoiceCount(params);
        res.json({invoices});
    } catch (err) {
        if (err instanceof Error) {
            debug("getAccountInvoiceCount()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getAccountInvoiceCount'});
    }
}
