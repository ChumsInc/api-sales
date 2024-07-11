/**
 * Created by steve on 1/6/2017.
 */

import {Router} from "express";

// const debug = require('debug')('chums:lib:b2b');
const router = Router();
import {getContactPermissions, postContactPermissions} from './contact-permissions.js';
import {getRepAccountList} from './account-list.js';
import {postLogSalesOrderAction} from './log-salesorder.js';
import * as orderLog from './order-log.js';
import {getOpenOrders, getOpenOrder} from './order-log.js';
import {getPastOrders} from './orders.js';
import {getCustomer} from './account.js';
import {getPromoCodes} from './promo_code.js';
import {getInvoices} from './invoices.js';
import {getItemValidation, renderItemValidation} from "./item-validation.js";
import {getOrderHistory} from "./order-history.js";

router.get('/account/:Company/:ARDivisionNo-:CustomerNo', getCustomer);
router.get('/account-list/:Company/:SalespersonDivisionNo-:SalespersonNo', getRepAccountList);
router.get('/account-list/:Company', getRepAccountList);

router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo', getInvoices);

router.get('/items/validation.html', renderItemValidation);
router.get('/items/validation.json', getItemValidation);


router.get('/order-log.json', getOpenOrders);
router.get('/order-log/:salesOrderNo.json', getOpenOrder);
router.put('/order-log/:salesOrderNo/:action.json', postLogSalesOrderAction);

router.get('/order-history.json', getOrderHistory);


router.get('/log/:Company(CHI|BCS|TST|BCT)', orderLog.getOrders);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:OrderType(B|C|S|Q|BS|BQS)/:SalesOrderNo?', orderLog.getOrders);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:SalesOrderNo', orderLog.getOrderHistory);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:minDate/:maxDate/stats', orderLog.getOrderUserStats);
router.post('/log/:action/:Company/:SalesOrderNo', postLogSalesOrderAction);

router.get('/orders/:Company/:ARDivisionNo-:CustomerNo', getPastOrders);


router.get('/permissions/:Company/:ARDivisionNo/:CustomerNo/:ContactCode', getContactPermissions);
router.post('/permissions/:Company/:ARDivisionNo/:CustomerNo/:ContactCode', postContactPermissions);

router.get('/promo/:id(\\d+)?', getPromoCodes);
router.get('/promo/:promo_code?', getPromoCodes);


export default router;
