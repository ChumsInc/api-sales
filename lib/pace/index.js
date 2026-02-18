import Debug from 'debug';
import { Router } from "express";
import { loadPaceByDivision } from './division.js';
import { loadPaceBySegment } from "./segment.js";
import { loadPaceByCustomer } from "./customer.js";
import dayjs from "dayjs";
const debug = Debug('chums:lib:pace');
const router = Router();
export const getPaceByDivision = async (req, res) => {
    try {
        const parms = {
            year: req.params.year ?? req.query.year ?? dayjs().format('YYYY'),
            month: req.params.month ?? req.query.month ?? dayjs().format('MM'),
        };
        const pace = await loadPaceByDivision(parms);
        res.json({ pace });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in ' });
    }
};
export const getPaceBySegment = async (req, res) => {
    try {
        const parms = {
            year: req.params.year ?? req.query.year ?? dayjs().format('YYYY'),
            month: req.params.month ?? req.query.month ?? dayjs().format('MM'),
            ARDivisionNo: req.params.ARDivisionNo,
        };
        const pace = await loadPaceBySegment(parms);
        res.json({ pace });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPaceBySegment()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getPaceBySegment' });
    }
};
export const getPaceByCustomer = async (req, res) => {
    try {
        const parms = {
            year: req.params.year ?? req.query.year ?? dayjs().format('YYYY'),
            month: req.params.month ?? req.query.month ?? dayjs().format('MM'),
            ARDivisionNo: req.params.ARDivisionNo,
        };
        const pace = await loadPaceByCustomer(parms);
        res.json({ pace });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getPaceByCustomer()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getPaceByCustomer' });
    }
};
router.get('/:ARDivisionNo/customer.json', getPaceByCustomer);
router.get('/:ARDivisionNo/segment.json', getPaceBySegment);
router.get('/chums.json', getPaceByDivision);
export default router;
