import {Router} from "express";
import {getContactPermissions, postContactPermissions} from './contact-permissions.js';
import {getRepAccountList} from './account-list.js';
import {postLogSalesOrderAction} from './log-salesorder.js';
import {getLoggedOpenOrders, getLoggedSalesOrder, getLoggedOrders, getLoggedOrderUserStats, getLoggedOrderHistory} from './order-log.js';
import {getPastOrders} from './orders.js';
import {getCustomer, getCustomerV2} from './account.js';
import {getPromoCodes} from './promo_code.js';
import {getInvoices} from './invoices.js';
import {getItemValidation, renderItemValidation} from "./item-validation.js";
import {getOrderHistory} from "./order-history.js";
import {getOpenOrders, getOpenSalesOrder} from "./open-orders.js";

const router = Router();

router.get('/account/:customerKey/customer.json', getCustomerV2);
router.get('/account/:customerKey/invoices.json', getInvoices);
router.get('/account/:customerKey/orders/open.json', getOpenOrders);
router.get('/account/:customerKey/orders/open/:salesOrderNo.json', getOpenSalesOrder);

router.get('/account/:Company/:ARDivisionNo-:CustomerNo', getCustomer);
router.get('/account-list/:salespersonSlug.json', getRepAccountList);
router.get('/account-list/:Company/:SalespersonDivisionNo-:SalespersonNo', getRepAccountList);
router.get('/account-list/:Company', getRepAccountList);

router.get('/invoices/:Company/:ARDivisionNo-:CustomerNo', getInvoices);

router.get('/items/validation.html', renderItemValidation);
router.get('/items/validation.json', getItemValidation);


router.get('/order-log.json', getLoggedOpenOrders);
router.get('/order-log/:salesOrderNo.json', getLoggedSalesOrder);
router.put('/order-log/:salesOrderNo/:action.json', postLogSalesOrderAction);

router.get('/order-history.json', getOrderHistory);


router.get('/log/:Company(CHI|BCS|TST|BCT)', getLoggedOrders);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:OrderType(B|C|S|Q|BS|BQS)/:SalesOrderNo?', getLoggedOrders);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:SalesOrderNo', getLoggedOrderHistory);
router.get('/log/:Company(CHI|BCS|TST|BCT)/:minDate/:maxDate/stats', getLoggedOrderUserStats);
router.post('/log/:action/:Company/:SalesOrderNo', postLogSalesOrderAction);

router.get('/orders/:customerKey/open.json', getOpenOrders);
router.get('/orders/:customerKey/open/:salesOrderNo.json', getOpenSalesOrder);
router.get('/orders/:Company/:ARDivisionNo-:CustomerNo', getPastOrders);


router.get('/permissions/:Company/:ARDivisionNo/:CustomerNo/:ContactCode', getContactPermissions);
router.post('/permissions/:Company/:ARDivisionNo/:CustomerNo/:ContactCode', postContactPermissions);

router.get('/promo/:id(\\d+)?', getPromoCodes);
router.get('/promo/:promo_code?', getPromoCodes);


export default router;
