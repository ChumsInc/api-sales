import Debug from 'debug';
import {Request, Response} from 'express'
import {loadRepAging, LoadRepAgingArgs, loadRepCustomerAging} from "./aging.js";

const debug = Debug('chums:lib:aging');

export const getAging = async (req:Request, res:Response):Promise<void> => {
    try {
        const userId = res.locals.profile?.user?.id ?? 0;
        const [salespersonDivisionNo, salespersonNo] = req.params.salespersonSlug?.split('-') ?? [];
        const args:LoadRepAgingArgs = {
            userId,
            salespersonDivisionNo: salespersonDivisionNo ?? req.params.SalespersonDivisionNo,
            salespersonNo: salespersonNo ?? req.params.SalespersonNo
        };
        const reps = await loadRepAging(args);
        const accounts = await loadRepCustomerAging(args);
        res.json({reps, accounts});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getAging()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getAging'});
    }
}
