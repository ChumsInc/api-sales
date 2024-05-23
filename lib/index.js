import Debug from 'debug';
import {Router} from 'express';
import {validateRole, validateUser} from 'chums-local-modules';
import {default as analysisRouter} from './analysis/index.js';

import {getSalesByBillToState, getSalesByShipToState} from './sales-map/index.js';
import {getHistoryGraphData} from './sales-history/index.js';
import {getAccountList, renderAccountList, renderAccountListXLSX} from "./account-list/bill-to.js";
import {getShipToAccountList, renderShipToAccountList, renderShipToAccountListXLSX} from "./account-list/ship-to.js";
import {getCommissionTotals} from "./commission/totals.js";
import {getRepCommissionDetail} from "./commission/detail.js";
import {
    getCMMargins,
    getOrderItemMargins,
    getOrderMargins,
    renderOrderMargins
} from './salesorder/open-order-margins.js';
import {getOpenSalesOrder, getSalesOrder} from './salesorder/sales-order.js';
import {default as b2bRouter} from './b2b/index.js';
import {validateRep} from './rep/validate-rep.js';
import {getRepItemHistory} from './rep/rep-item-history.js';
import {getCondensedRepList, getRepList, getUserRepList} from './rep/rep-list.js';
import {getRepManagers, getRepPace} from './rep/rep-pace.js'
import {getRepPaceXLSX} from './rep/rep-pace-xlsx.js';
import {getRepAccounts, getRepAccountsXLSX, getRepTotals} from './rep/account-list.js';
import {getRepOrders} from './rep/rep-orders.js';
import {execGDPRRequest, execGDPRSORequest, getGDPRSORequest} from './gdpr/index.js'

import {
    getAccountInvoiceCount,
    getAccountInvoices,
    getMissingTaxSchedules,
    renderMissingTaxSchedules
} from './account/index.js';
import {getInvoice} from "./account/invoice.js";
import {getCustomerItemSales} from './customer-item-sales/index.js';
import {getAccountOpenOrders} from "./salesorder/account-orders.js";
import {getOpenItems} from "./salesorder/open-items.js";
import {getSafetyRepInvoices} from "./rep/safety-invoices.js";
import {getOrderStatusList} from "./salesorder/order-status.js";
import {
    delNewPricingEntry,
    getAllPricing,
    getPriceChangeUsers,
    getPriceCode,
    getPriceCodes,
    getPriceLevel,
    getPriceLevels,
    getUserChangesImport,
    getUserPriceChanges,
    postNewPricing,
    postPriceLevel,
    postPriceLevelSort
} from "./pricing/index.js";
import {default as paceRouter} from './pace/index.js';
import {getCensusAudit, getCensusAuditXLSX} from "./audits/census-audit.js";
import {getCustomersByType, getCustomerTypes} from "./customer-types/index.js";
import {
    getTerminatedRepAccounts,
    getTerminatedRepInvoices,
    getTerminatedRepOpenOrders,
    renderTerminatedRepInvoiceReport,
    renderTerminatedRepOrdersReport
} from "./rep/terminated-rep-reports.js";
import {getOpenRepOrders} from "./rep/open-orders.js";
import {aboutAPI} from "./about/index.js";
import {getRepMismatch, renderRepMismatch} from "./audits/sales-order/rep-mismatch.js";
import {getAging} from "./aging/index.js";
import {getCustomerShipToAudit, renderCustomerShipToAudit} from "./audits/customer/ship-to-rep.js";

const debug = Debug('chums:lib');
const router = Router();

function logPath(req, res, next) {
    const user = res.locals.profile?.user?.email || res.locals.profile?.user?.id || '-';
    debug(req.ip, user, req.method, req.originalUrl, req.get('referer'));
    res.locals.response = {};
    next();
}

router.use(validateUser);
router.use(logPath);

router.get('/about', aboutAPI);
router.get('/account-list/bill-to', validateRole(['sales', 'rep']), getAccountList);
router.post('/account-list/bill-to/render', validateRole(['sales', 'rep']), renderAccountList);
router.post('/account-list/bill-to/xlsx', validateRole(['sales', 'rep']), renderAccountListXLSX);

router.get('/account-list/ship-to', validateRole(['sales', 'rep']), getShipToAccountList);
router.post('/account-list/ship-to/render', validateRole(['sales', 'rep']), renderShipToAccountList);
router.post('/account-list/ship-to/xlsx', validateRole(['sales', 'rep']), renderShipToAccountListXLSX);

router.get('/aging', getAging);
router.get('/aging/:SalespersonDivisionNo-:SalespersonNo', getAging);


router.use('/analysis', validateRole('sales'), analysisRouter);

router.get('/audit/sales-orders/rep-mismatch.json', getRepMismatch);
router.get('/audit/sales-orders/rep-mismatch.html', renderRepMismatch);

router.use('/b2b', b2bRouter);

router.get('/census-audit/:minDate(\\d{4}-\\d{2}-\\d{2})-:maxDate(\\d{4}-\\d{2}-\\d{2})', getCensusAudit);
router.get('/census-audit/:minDate(\\d{4}-\\d{2}-\\d{2})-:maxDate(\\d{4}-\\d{2}-\\d{2}).xlsx', getCensusAuditXLSX);

router.get('/customer-types', getCustomerTypes);
router.get('/customer-types/:ARDivisionNo(\\d{2})/:CustomerType', getCustomersByType);

router.get('/commission/:company(chums|bc)/:minDate/:maxDate', validateRole(['commission']), getCommissionTotals);
router.get('/commission/:company(chums|bc)/:minDate/:maxDate/:SalespersonDivisionNo-:SalespersonNo', validateRole(['commission']), getRepCommissionDetail);


router.get('/customer/items/:FiscalCalYear/:company(chums|bc)/:ARDivisionNo-:CustomerNo/:ItemCode?', getCustomerItemSales);
router.get('/customer/items/:FiscalCalYear/:company(chums|bc)/:ItemCode?', getCustomerItemSales);

router.get('/gdpr/:Company(chums|bc)/:SalesOrderNo', getGDPRSORequest);
router.post('/gdpr/:Company(chums|bc)/:SalesOrderNo', execGDPRSORequest);
router.post('/gdpr/:company(chums|bc)', execGDPRRequest);
router.get('/history-graph/:Company', getHistoryGraphData);

router.get('/invoice/:Company/:ARDivisionNo-:CustomerNo/:InvoiceNo', getInvoice);
router.get('/invoice/:Company/:InvoiceType(AD|CA|CM|DM|IN)/:InvoiceNo', getInvoice);
router.get('/invoice/:Company/:InvoiceNo', getInvoice);
router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo/count', getAccountInvoiceCount);
router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo', getAccountInvoices);

router.get('/orders/items/:company(chums|bc)/:ARDivisionNo-:CustomerNo', getOpenItems);
router.get('/orders/margins/:company(chums|bc)/:salesOrderNo([\\S]{7})', getOrderItemMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)?', getOrderMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/cm', getCMMargins);
router.get('/orders/margins/:company(chums|bc)/:maxMargin([0-9\\.]+)/render', renderOrderMargins);
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
router.get('/rep/pace/:Company/reps', getRepList);
router.get('/rep/orders/:Company', getOpenRepOrders);

router.get('/rep/:company/:salespersonDivisionNo-:salespersonNo/:minDate/:maxDate/items', validateRep, getRepItemHistory);

router.get('/sales-map/:year', validateRole('sales'), getSalesByBillToState);
router.get('/sales-map/:year/shipToState', validateRole('sales'), getSalesByShipToState);

router.get('/validate/customer/ship-to-rep.json', getCustomerShipToAudit);
router.get('/validate/customer/ship-to-rep.html', renderCustomerShipToAudit);
router.get('/validate/tax-schedules', getMissingTaxSchedules);
router.get('/validate/tax-schedules/render', renderMissingTaxSchedules);
router.get('/validate/terminated-reps/audit-report/orders.html', renderTerminatedRepOrdersReport);
router.get('/validate/terminated-reps/audit-report/invoices.html', renderTerminatedRepInvoiceReport);
router.get('/validate/terminated-reps/audit-report/orders', getTerminatedRepOpenOrders);
router.get('/validate/terminated-reps/audit-report/invoices', getTerminatedRepInvoices);
router.get('/validate/terminated-reps/audit-report/accounts', getTerminatedRepAccounts);
router.get('/validate/rep-mismatch/audit-report/orders', getRepMismatch)
router.get('/validate/rep-mismatch/audit-report/orders.html', renderRepMismatch)

export default router;
