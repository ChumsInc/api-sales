const Debug = require('debug');
const {loadPaceByDivision} = require('./division');
const {Router} = require('express');
const {loadPaceBySegment} = require("./segment");
const {loadPaceByCustomer} = require("./customer");

const debug = Debug('chums:lib:pace');
const router = Router();

const getPaceByDivision = async (req, res) => {
    try {
        const {company, year, month} = req.params;
        const pace = await loadPaceByDivision({company, year, month})
        res.json({pace});
    } catch(err) {
        if (err instanceof Error) {
            debug("()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in '});
    }
}

const getPaceBySegment = async (req, res) => {
    try {
        const {company, year, month, ARDivisionNo} = req.params;
        const pace = await loadPaceBySegment({company, year, month, ARDivisionNo});
        res.json({pace});
    } catch(err) {
        if (err instanceof Error) {
            debug("getPaceBySegment()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPaceBySegment'});
    }
}

const getPaceByCustomer = async (req, res) => {
    try {
        const {company, year, month, ARDivisionNo} = req.params;
        const pace = await loadPaceByCustomer({company, year, month, ARDivisionNo});
        res.json({pace});
    } catch(err) {
        if (err instanceof Error) {
            debug("getPaceByCustomer()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPaceByCustomer'});
    }
}
const getPaceByInvoice = async (req, res) => {
    res.json({error: 'Stay tuned, in process.'})
}

router.get('/:company/:year(\\d{4})-:month(\\d{2})/:ARDivisionNo/customer', getPaceByCustomer);
router.get('/:company/:year(\\d{4})-:month(\\d{2})/:ARDivisionNo/segment', getPaceBySegment);
router.get('/:company/:year(\\d{4})-:month(\\d{2})', getPaceByDivision);
router.get('/:company/:year(\\d{4})/:month(\\d{2})', getPaceByDivision);

exports.router = router;


