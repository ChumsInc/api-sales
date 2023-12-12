import Debug from 'debug';
import {Request, Response} from 'express'
import {loadRepAging, LoadRepAgingArgs, loadRepCustomerAging} from "./aging.js";

const debug = Debug('chums:lib:aging');

export const getAging = async (req:Request, res:Response) => {
    try {
        const userId = res.locals.profile?.user?.id ?? 0;
        const args:LoadRepAgingArgs = {
            userId,
            salespersonDivisionNo: req.params.SalespersonDivisionNo,
            salespersonNo: req.params.SalespersonNo
        };
        const reps = await loadRepAging(args);
        const accounts = await loadRepCustomerAging(args);
        res.json({reps, accounts});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getAging()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getAging'});
    }
}
