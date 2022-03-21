const debug = require('debug')('chums:lib');
const router = require('express').Router();
const {validateUser, validateRole} = require('chums-local-modules');
const analysis = require('./analysis');
const salesMap = require('./sales-map');
const salesHistory = require('./sales-history');
const accountList = require('./account-list');
const commission = require('./commission');
const salesOrderMargins = require('./salesorder/open-order-margins');
const {getOpenSalesOrder} = require('./salesorder/sales-order');
const sps = require('./sps');
const b2b = require('./b2b');
const {validateRep} = require('./rep/validate-rep');
const {getRepItemHistory} = require('./rep/rep-item-history');
const {getRepList, getCondensedRepList, getUserRepList} = require('./rep/rep-list');
const {getRepManagers, getRepPace} = require('./rep/rep-pace')
const {getRepPaceXLSX} = require('./rep/rep-pace-xlsx')
const {getRepAccounts, getRepTotals, getRepAccountsXLSX} = require('./rep/account-list');
const {getRepOrders} = require('./rep/rep-orders');
const {execGDPRRequest, getGDPRSORequest, execGDPRSORequest} = require('./gdpr')
const {postFBAInvoice} = require('./amazon/seller-central/fba-invoice');
const {getAccountInvoices} = require('./account');

exports.router = router;

router.use(function (req, res, next) {
    //set up res.locals.response for all routing
    debug(req.method, req.originalUrl, req.get('referrer'));
    res.locals.response = {};
    next();
});

router.use(validateUser);
router.use('/account-list', validateRole(['sales', 'rep']), accountList.router);
router.post('/amazon/seller-central/fba/invoice', validateRole('accounting'), postFBAInvoice);
router.use('/analysis', validateRole('sales'), analysis.router);
router.use('/b2b', b2b.router);
router.use('/commission', validateRole(['commission']), commission.router);
router.get('/gdpr/:Company(chums|bc)/:SalesOrderNo', getGDPRSORequest);
router.post('/gdpr/:Company(chums|bc)/:SalesOrderNo', execGDPRSORequest);
router.post('/gdpr/:company(chums|bc)', execGDPRRequest);
router.get('/history-graph/:Company', salesHistory.getHistoryGraphData);

router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo', getAccountInvoices);

router.get('/orders/margins/:company(chums|bc)/:salesOrderNo([\\S]{7})', salesOrderMargins.getOrderItemMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)?', salesOrderMargins.getOrderMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/cm', salesOrderMargins.getCMMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/render', salesOrderMargins.renderOrderMargins);
router.get('/orders/open/:company/:salesOrderNo', getOpenSalesOrder);

// router.get('/rep/commission/:company(chums|bc|CHI|BCS)/:from/:to', getCommissionReport);
// router.get('/rep/commission/:company(chums|bc|CHI|BCS)/:from/:to/xlsx', getCommissionReportXLSX);
// router.get('/rep/commission/:company(chums|bc|CHI|BCS)/:from/:to/totals', getCommissionReportTotals);

router.get('/rep/account-list/:Company(chums|bc)/totals/:asOfDate(\\d{4}-\\d{2}-\\d{2})?', getRepTotals);
router.get('/rep/account-list/:Company(chums|bc)/:SalespersonNo([0-9A-Z]+)/:asOfDate(\\d{4}-\\d{2}-\\d{2})?', getRepAccounts);
router.get('/rep/account-list/:Company(chums|bc)/:SalespersonNo([0-9A-Z]+)/:asOfDate(\\d{4}-\\d{2}-\\d{2})/xlsx', getRepAccountsXLSX);
router.get('/rep/account-orders/:Company(chums|bc)/:SalespersonNo([0-9A-Z]+)', getRepOrders);

router.get('/rep/list/:company(chums|bc|CHI|BCS)', getRepList);
router.get('/rep/list/:company(chums|bc|CHI|BCS)/condensed', getCondensedRepList);
router.get('/rep/list/:company/:userid(\\d+)', getUserRepList);

router.get('/rep/managers/:Company/:SalespersonDivisionNo-:SalespersonNo', getRepManagers);
router.get('/rep/managers/:Company', getRepManagers);

router.get('/rep/pace/:Company/:SalespersonDivisionNo-:SalespersonNo/:minDate/:maxDate', getRepPace);
router.get('/rep/pace/:Company/:SalespersonDivisionNo-:SalespersonNo/:minDate/:maxDate/xlsx', getRepPaceXLSX);
router.get('/rep/pace/:Company/:minDate/:maxDate', getRepPace);

router.get('/rep/:company/:salespersonDivisionNo-:salespersonNo/:minDate/:maxDate/items', validateRep, getRepItemHistory);

router.get('/sales-map/:year', validateRole('sales'), salesMap.getSalesByBillToState);
router.get('/sales-map/:year/shipToState', validateRole('sales'), salesMap.getSalesByShipToState);

router.use('/sps', sps.router);

