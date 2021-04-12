const debug = require('debug')('chums:lib');
const router = require('express').Router();
const {validateUser, validateRole} = require('chums-local-modules');
const analysis = require('./analysis');
const salesMap = require('./sales-map');
const salesHistory = require('./sales-history');
const accountList = require('./account-list');
const commission = require('./commission');
const salesOrderMargins = require('./salesorder/open-order-margins');

exports.router = router;

router.use(function (req, res, next) {
    //set up res.locals.response for all routing
    debug(req.method, req.originalUrl, req.get('referrer'));
    res.locals.response = {};
    next();
});

router.use(validateUser);
router.use('/account-list', validateRole(['sales', 'rep']), accountList.router);
router.use('/analysis', validateRole('sales'), analysis.router);
router.use('/commission', validateRole(['commission']), commission.router);
router.use('/history-graph/:Company', salesHistory.getHistoryGraphData);
router.get('/orders/margins/:company(chums|bc)/:salesOrderNo([\\S]{7})', salesOrderMargins.getOrderItemMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)?', salesOrderMargins.getOrderMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/cm', salesOrderMargins.getCMMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/render', salesOrderMargins.renderOrderMargins);

router.use('/sales-map/:year', validateRole('sales'), salesMap.get);

