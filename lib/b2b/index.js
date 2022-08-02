/**
 * Created by steve on 1/6/2017.
 */


// const debug = require('debug')('chums:lib:b2b');
const router = require('express').Router();
const contactPermissions = require('./contact-permissions');
const accountList = require('./account-list');
const logSalesOrder = require('./log-salesorder');
const orderLog = require('./order-log');
const orders = require('./orders');
const account = require('./account');
const {getPromoCodes} = require('./promo_code');
const {getInvoices} = require('./invoices');

router.get('/account/:Company/:ARDivisionNo-:CustomerNo', account.getCustomer);
router.get('/account-list/:Company/:SalespersonDivisionNo-:SalespersonNo', accountList.getRepAccountList);
router.get('/account-list/:Company', accountList.getRepAccountList);

router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo', getInvoices);

router.get('/log/:Company(CHI|BCS|TST|BCT)', orderLog.getOrders);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:OrderType(B|C|S|Q|BS|BQS)/:SalesOrderNo?', orderLog.getOrders);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:SalesOrderNo', orderLog.getOrderHistory);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:minDate/:maxDate/stats', orderLog.getOrderUserStats);
router.post('/log/:action/:Company/:SalesOrderNo', logSalesOrder.postAction);

router.get('/orders/:Company/:ARDivisionNo-:CustomerNo', orders.getPastOrders);


router.get('/permissions/:Company/:ARDivisionNo/:CustomerNo/:ContactCode', contactPermissions.get);
router.post('/permissions/:Company/:ARDivisionNo/:CustomerNo/:ContactCode', contactPermissions.post);

router.get('/promo/:id(\\d+)?', getPromoCodes);
router.get('/promo/:promo_code?', getPromoCodes);


exports.router = router;
