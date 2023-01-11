const debug = require('debug')('chums:lib');
const router = require('express').Router();
const {validateUser, validateRole} = require('chums-local-modules');
const analysis = require('./analysis');
const salesMap = require('./sales-map');
const salesHistory = require('./sales-history');
const accountList = require('./account-list');
const commission = require('./commission');
const salesOrderMargins = require('./salesorder/open-order-margins');
const {getOpenSalesOrder, getSalesOrder} = require('./salesorder/sales-order');
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
const {getAccountInvoices, getMissingTaxSchedules, renderMissingTaxSchedules, getAccountInvoiceCount} = require('./account');
const {getInvoice} = require("./account/invoice");
const {getCustomerItemSales} = require('./customer-item-sales');
const {getAccountOpenOrders} = require("./salesorder/account-orders");
const {getOpenItems} = require("./salesorder/open-items");
const {getSafetyRepInvoices} = require("./rep/safety-invoices");
const {getOrderStatusList} = require("./salesorder/order-status");
const {getPriceLevels, getPriceChangeUsers, getUserPriceChanges, getUserChangesImport, postNewPricing,
    delNewPricingEntry, getAllPricing, getPriceCodes, getPriceCode, getPriceLevel, postPriceLevel, postPriceLevelSort
} = require("./pricing");

const {router:paceRouter} = require('./pace/index');

const {getCensusAudit, getCensusAuditXLSX} = require("./audits/census-audit");
const {getCustomerTypes, getCustomersByType} = require("./customer-types");

function logPath(req, res, next) {
    const user = res.locals.profile?.user?.email || res.locals.profile?.user?.id || '-';
    debug(req.ip, user, req.method, req.originalUrl, req.get('referer'));
    res.locals.response = {};
    next();
}

exports.router = router;

router.use(validateUser);
router.use(logPath);

router.use('/account-list', validateRole(['sales', 'rep']), accountList.router);
router.post('/amazon/seller-central/fba/invoice', validateRole('accounting'), postFBAInvoice);
router.use('/analysis', validateRole('sales'), analysis.router);
router.use('/b2b', b2b.router);

router.get('/census-audit/:minDate(\\d{4}-\\d{2}-\\d{2})-:maxDate(\\d{4}-\\d{2}-\\d{2})', getCensusAudit);
router.get('/census-audit/:minDate(\\d{4}-\\d{2}-\\d{2})-:maxDate(\\d{4}-\\d{2}-\\d{2}).xlsx', getCensusAuditXLSX);

router.get('/customer-types', getCustomerTypes);
router.get('/customer-types/:ARDivisionNo(\\d{2})/:CustomerType', getCustomersByType);

router.use('/commission', validateRole(['commission']), commission.router);

router.get('/customer/items/:FiscalCalYear/:company(chums|bc)/:ARDivisionNo-:CustomerNo/:ItemCode?', getCustomerItemSales);
router.get('/customer/items/:FiscalCalYear/:company(chums|bc)/:ItemCode?', getCustomerItemSales);

router.get('/gdpr/:Company(chums|bc)/:SalesOrderNo', getGDPRSORequest);
router.post('/gdpr/:Company(chums|bc)/:SalesOrderNo', execGDPRSORequest);
router.post('/gdpr/:company(chums|bc)', execGDPRRequest);
router.get('/history-graph/:Company', salesHistory.getHistoryGraphData);

router.get('/invoice/:Company/:ARDivisionNo-:CustomerNo/:InvoiceNo', getInvoice);
router.get('/invoice/:Company/:InvoiceType(AD|CA|CM|DM|IN)/:InvoiceNo', getInvoice);
router.get('/invoice/:Company/:InvoiceNo', getInvoice);
router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo/count', getAccountInvoiceCount);
router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo', getAccountInvoices);

router.get('/orders/items/:company(chums|bc)/:ARDivisionNo-:CustomerNo', getOpenItems);
router.get('/orders/margins/:company(chums|bc)/:salesOrderNo([\\S]{7})', salesOrderMargins.getOrderItemMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)?', salesOrderMargins.getOrderMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/cm', salesOrderMargins.getCMMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/render', salesOrderMargins.renderOrderMargins);
router.get('/orders/open/:company/:ARDivisionNo(\\d{2})-:CustomerNo', getAccountOpenOrders)
router.get('/orders/open/:company/:salesOrderNo', getOpenSalesOrder);
router.get('/orders/status/:Company(chums|bc)/:dateType(od|sd)/:minDate/:maxDate', getOrderStatusList);
router.get('/orders/:company/:salesOrderNo', getSalesOrder);


// router.get('/rep/commission/:company(chums|bc|CHI|BCS)/:from/:to', getCommissionReport);
// router.get('/rep/commission/:company(chums|bc|CHI|BCS)/:from/:to/xlsx', getCommissionReportXLSX);
// router.get('/rep/commission/:company(chums|bc|CHI|BCS)/:from/:to/totals', getCommissionReportTotals);

router.use('/pace', paceRouter);


router.get('/pricing/:Company(chums|bc)/pricelevels', validateRole(['cost']), getPriceLevels);
router.post('/pricing/:Company(chums|bc)/pricelevels/sort', validateRole(['cost']), postPriceLevelSort);
router.get('/pricing/:Company(chums|bc)/pricelevels/:CustomerPriceLevel', validateRole(['cost']), getPriceLevel);
router.post('/pricing/:Company(chums|bc)/pricelevels/:CustomerPriceLevel', validateRole(['cost']), postPriceLevel);
router.get('/pricing/:Company(chums|bc)/pricecodes', validateRole(['cost']), getPriceCodes);
router.get('/pricing/:Company(chums|bc)/pricecodes/:PriceCode', validateRole(['cost']), getPriceCode);
router.get('/pricing/:Company(chums|bc)/pricecodes/:PriceCode/:CustomerPriceLevel', validateRole(['cost']), getPriceCode);
router.get('/pricing/:Company(chums|bc)/changes/', validateRole(['cost']), getPriceChangeUsers);
router.get('/pricing/:Company(chums|bc)/changes/:UserName.txt', validateRole(['cost']), getUserChangesImport);
router.get('/pricing/:Company(chums|bc)/changes/:UserName', validateRole(['cost']), getUserPriceChanges);
router.get('/pricing/:Company(chums|bc)/:PriceCode/:CustomerPriceLevel?', validateRole(['cost']), getPriceCode);
router.get('/pricing/:Company(chums|bc)', validateRole(['cost']), getAllPricing);
router.post('/pricing/:Company(chums|bc)/:PriceCode/:CustomerPriceLevel', validateRole(['cost']), postNewPricing);
router.delete('/pricing/:Company(chums|bc)/:PriceCode/:CustomerPriceLevel', validateRole(['cost']), delNewPricingEntry);


router.get('/rep/account-list/:Company(chums|bc)/totals/:asOfDate(\\d{4}-\\d{2}-\\d{2})?', getRepTotals);
router.get('/rep/account-list/:Company(chums|bc)/:SalespersonNo([0-9A-Z]+)/:asOfDate(\\d{4}-\\d{2}-\\d{2})?', getRepAccounts);
router.get('/rep/account-list/:Company(chums|bc)/:SalespersonNo([0-9A-Z]+)/:asOfDate(\\d{4}-\\d{2}-\\d{2})/xlsx', getRepAccountsXLSX);
router.get('/rep/account-orders/:Company(chums|bc)/:SalespersonNo([0-9A-Z]+)', getRepOrders);

router.get('/rep/list/:company(chums|bc|CHI|BCS)', getRepList);
router.get('/rep/list/:company(chums|bc|CHI|BCS)/condensed', getCondensedRepList);
router.get('/rep/list/:company/:userid(\\d+)', getUserRepList);

router.get('/rep/safety/invoices/:company(chums|bc)/:SalespersonDivisionNo-:SalespersonNo/:minDate/:maxDate', validateRep, getSafetyRepInvoices);

router.get('/rep/managers/:Company/:SalespersonDivisionNo-:SalespersonNo', getRepManagers);
router.get('/rep/managers/:Company', getRepManagers);

router.get('/rep/pace/:Company/:SalespersonDivisionNo-:SalespersonNo/:minDate/:maxDate', getRepPace);
router.get('/rep/pace/:Company/:SalespersonDivisionNo-:SalespersonNo/:minDate/:maxDate/xlsx', getRepPaceXLSX);
router.get('/rep/pace/:Company/:minDate/:maxDate', getRepPace);

router.get('/rep/:company/:salespersonDivisionNo-:salespersonNo/:minDate/:maxDate/items', validateRep, getRepItemHistory);

router.get('/sales-map/:year', validateRole('sales'), salesMap.getSalesByBillToState);
router.get('/sales-map/:year/shipToState', validateRole('sales'), salesMap.getSalesByShipToState);

router.get('/validate/tax-schedules', getMissingTaxSchedules);
router.get('/validate/tax-schedules/render', renderMissingTaxSchedules);

router.use('/sps', sps.router);

