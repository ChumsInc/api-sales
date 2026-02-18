import Debug from 'debug';
import {Request, Response, Router} from "express";
import {loadPaceByDivision} from './division.js';
import {loadPaceBySegment} from "./segment.js";
import {loadPaceByCustomer} from "./customer.js";
import {PaceDivisionParams, PaceParams} from "./pace-types.js";
import dayjs from "dayjs";

const debug = Debug('chums:lib:pace');
const router = Router();

export const getPaceByDivision = async (req: Request, res: Response) => {
    try {
        const parms: PaceParams = {
            year: req.params.year as string ?? req.query.year as string ?? dayjs().format('YYYY'),
            month: req.params.month as string ?? req.query.month as string ?? dayjs().format('MM'),
        }
        const pace = await loadPaceByDivision(parms)
        res.json({pace});
    } catch (err) {
        if (err instanceof Error) {
            debug("()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in '});
    }
}

export const getPaceBySegment = async (req: Request, res: Response) => {
    try {
        const parms: PaceDivisionParams = {
            year: req.params.year as string ?? req.query.year as string ?? dayjs().format('YYYY'),
            month: req.params.month as string ?? req.query.month as string ?? dayjs().format('MM'),
            ARDivisionNo: req.params.ARDivisionNo as string,
        }
        const pace = await loadPaceBySegment(parms);
        res.json({pace});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPaceBySegment()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPaceBySegment'});
    }
}

export const getPaceByCustomer = async (req: Request, res: Response) => {
    try {
        const parms: PaceDivisionParams = {
            year: req.params.year as string ?? req.query.year as string ?? dayjs().format('YYYY'),
            month: req.params.month as string ?? req.query.month as string ?? dayjs().format('MM'),
            ARDivisionNo: req.params.ARDivisionNo as string,
        }
        const pace = await loadPaceByCustomer(parms);
        res.json({pace});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPaceByCustomer()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPaceByCustomer'});
    }
}

router.get('/:ARDivisionNo/customer.json', getPaceByCustomer);
router.get('/:ARDivisionNo/segment.json', getPaceBySegment);
router.get('/chums.json', getPaceByDivision);

export default router;


