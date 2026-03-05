import type {Request, Response} from 'express'
import {loadRepInfo, loadRepManagers, loadRepPace, loadUserReps} from "./reps.js";
import Debug from "debug";
import type {LoadRepPaceProps, LoadRepProps} from "./types.js";
import type {ValidatedUser} from "chums-local-modules";

export {getRepPaceXLSX} from './excel-handler.js'

const debug = Debug('chums:lib:rep:pace');

export async function getRepList(req: Request, res: Response) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const reps = loadUserReps(userid);
        res.json({reps});
    } catch (err) {
        if (err instanceof Error) {
            debug("getRepList()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getRepList'});
    }
}

export async function getRepPace(req: Request, res: Response<unknown, ValidatedUser>) {
    try {
        const params: LoadRepPaceProps = {
            SalespersonDivisionNo: req.params.SalespersonDivisionNo as string ?? req.query.SalespersonDivisionNo as string,
            SalespersonNo: req.params.SalespersonNo as string ?? req.query.SalespersonNo as string,
            minDate: req.params.minDate as string ?? req.query.minDate as string,
            maxDate: req.params.maxDate as string ?? req.query.maxDate as string,
            groupByCustomer: true,
            userid: res.locals.profile!.user.id,
        };
        const pace = await loadRepPace(params);
        res.json({pace});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getRepPace()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getRepPace'});
    }
}

export async function getRepManagers(req: Request, res: Response<unknown, ValidatedUser>) {
    try {
        const params: LoadRepProps = {
            SalespersonDivisionNo: req.params.SalespersonDivisionNo as string,
            SalespersonNo: req.params.SalespersonNo as string,
            userid: res.locals.profile!.user.id,
        };
        const rep = await loadRepInfo(params);
        if (!rep) {
            return res.json({rep: null});
        }
        rep.manager = await loadRepManagers({...rep});
        res.json({rep});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getRepManagers()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getRepManagers'});
    }
}

