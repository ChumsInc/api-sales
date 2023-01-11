const Debug = require('debug');
const {loadYearInvoiceCount, loadAccountInvoices} = require("./invoices");
const {loadMissingTaxSchedules} = require("./missing-tax-shedule");

const debug = Debug('chums:lib:account');


async function renderMissingTaxSchedules(req, res) {
    try {
        const accounts = await loadMissingTaxSchedules();
        if (!accounts || accounts.length === 0) {
            res.status(301).send();
            return;
        }
        res.render('./sales/missing-tax-schedule.pug', {accounts});
    } catch(err) {
        if (err instanceof Error) {
            debug("renderMissingTaxSchedules()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in renderMissingTaxSchedules'});
    }
}

async function getMissingTaxSchedules(req, res) {
    try {
        const accounts = await loadMissingTaxSchedules();
        res.json({accounts});

    } catch(err) {
        if (err instanceof Error) {
            debug("getMissingTaxSchedules()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getMissingTaxSchedules'});
    }
}

async function getAccountInvoices(req, res) {
    try {
        const params = {
            user_id: res.locals.profile.user.id,
            Company: req.params.Company,
            ARDivisionNo: req.params.ARDivisionNo,
            CustomerNo: req.params.CustomerNo,
            year: req.query.year,
            offset: req.query.offset || 0,
            limit: req.query.limit || 1000
        };
        const result = await loadAccountInvoices(params);
        res.json({result});
    } catch (err) {
        debug("getAccountInvoices()", err.message);
        res.json({error: err.message});
    }
}

async function getAccountInvoiceCount(req, res) {
    try {
        const params = {
            user_id: res.locals.profile.user.id,
            Company: req.params.Company,
            ARDivisionNo: req.params.ARDivisionNo,
            CustomerNo: req.params.CustomerNo
        };
        const invoices = await loadYearInvoiceCount(params);
        res.json({invoices});
    } catch(err) {
        if (err instanceof Error) {
            debug("getAccountInvoiceCount()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getAccountInvoiceCount'});
    }
}

exports.getAccountInvoices = getAccountInvoices;
exports.getAccountInvoiceCount = getAccountInvoiceCount;
exports.getMissingTaxSchedules = getMissingTaxSchedules;
exports.renderMissingTaxSchedules = renderMissingTaxSchedules;
