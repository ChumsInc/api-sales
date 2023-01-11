/**
 * Created by steve on 12/15/2016.
 */
import Debug from 'debug';
import {sageOdbc} from 'chums-base';
import {queryFilters} from '../utils.js';

const debug = Debug('chums:api:sales:pace5:orders');


/**
 *
 * @param {Object} params
 * @param {string} params.company
 * @param {string} params.minDate
 * @param {string} params.maxDate
 * @param {string} params.totalBy
 * @param {string?} params.ARDivisionNo
 * @param {string?} params.CustomerNo
 * @param {string?} params.CustomerType
 */
export async function loadPreviousOpenOrders(params) {
    // debug('loadPreviousOpenOrders()', params);
    let filter = queryFilters(params);
    let groupBy = 'o.ARDivisionNo';
    let key = 'ARDivisionNo';

    switch (params.totalBy) {
    case 'ARDivisionNo':
        groupBy = 'c.ARDivisionNo';
        key = 'c.ARDivisionNo';
        break;
    case 'CustomerType':
        groupBy = 'c.ARDivisionNo, c.CustomerType';
        key = 'CustomerType';
        break;
    case 'CustomerNo':
        groupBy = 'c.ARDivisionNo, c.CustomerNo, c.CustomerName, c.CreditHold';
        key = 'CustomerNo';
        break;
    case 'SalesOrderNo':
        groupBy = 'o.SalesOrderNo, o.ShipExpireDate, o.OrderType, o.BillToName, o.ShipToCode, o.ShipToName, o.CustomerPONo';
        key = 'SalesOrderNo';
        break;
    }

    const query = `SELECT ${groupBy}, SUM(o.TaxableAmt + o.NonTaxableAmt - o.DiscountAmt) AS PrevOrderTotal
                   FROM AR_Customer c,
                        SO_SalesOrderHeader o
                   WHERE c.ARDivisionNo = o.ARDivisionNo
                     AND c.CustomerNo = o.CustomerNo
                     AND (
                           (o.OrderType <> 'Q' AND o.OrderType <> 'M')
                           AND (o.OrderStatus <> 'H')
                           AND (c.CreditHold <> 'Y')
                           AND (o.ShipExpireDate < {d :minDate})
                           AND (o.CurrentInvoiceNo IS NULL)
                       )
                       ${filter.query}
                   GROUP BY ${groupBy}`;
    const data = {...filter.data, minDate: params.minDate};
    try {
        const connection = await sageOdbc.getConnection(params.company);
        const {records} = await connection.query(query, data);
        return {field: 'PrevOrderTotal', key, records};
    } catch (err) {
        debug("loadPreviousOpenOrders()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {string} params.company
 * @param {string} params.minDate
 * @param {string} params.maxDate
 * @param {string} params.totalBy
 * @param {string?} params.ARDivisionNo
 * @param {string?} params.CustomerNo
 * @param {string?} params.CustomerType
 */
export async function loadOpenOrders(params) {
    // debug('loadOpenOrders()', params);
    let filter = queryFilters(params);
    let groupBy = 'o.ARDivisionNo';
    let key = 'ARDivisionNo';

    switch (params.totalBy) {
    case 'ARDivisionNo':
        groupBy = 'c.ARDivisionNo';
        key = 'c.ARDivisionNo';
        break;
    case 'CustomerType':
        groupBy = 'c.ARDivisionNo, c.CustomerType';
        key = 'CustomerType';
        break;
    case 'CustomerNo':
        groupBy = 'c.ARDivisionNo, c.CustomerNo, c.CustomerName, c.CreditHold';
        key = 'CustomerNo';
        break;
    case 'SalesOrderNo':
        groupBy = 'o.SalesOrderNo, o.ShipExpireDate, o.OrderType, o.BillToName, o.ShipToCode, o.ShipToName, o.CustomerPONo';
        key = 'SalesOrderNo';
        break;
    }


    const query = `SELECT ${groupBy}, SUM(o.TaxableAmt + o.NonTaxableAmt - o.DiscountAmt) AS OrderTotal
                   FROM AR_Customer c,
                        SO_SalesOrderHeader o
                   WHERE c.ARDivisionNo = o.ARDivisionNo
                     AND c.CustomerNo = o.CustomerNo
                     AND (
                           (o.OrderType <> 'Q' AND o.OrderType <> 'M')
                           AND (o.OrderStatus <> 'H')
                           AND (c.CreditHold <> 'Y')
                           AND (o.ShipExpireDate >= {d :minDate} AND o.ShipExpireDate <= {d :maxDate})
                           AND (o.CurrentInvoiceNo IS NULL)
                       )
                       ${filter.query}
                   GROUP BY ${groupBy}`;
    const data = {...filter.data, maxDate: params.maxDate, minDate: params.minDate};
    try {
        const connection = await sageOdbc.getConnection(params.company);
        const {records} = await connection.query(query, data);
        return {field: 'OrderTotal', key, records};
    } catch (err) {
        debug("loadOpenOrders()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Object} params
 * @param {string} params.company
 * @param {string} params.minDate
 * @param {string} params.maxDate
 * @param {string} params.totalBy
 * @param {string?} params.ARDivisionNo
 * @param {string?} params.CustomerNo
 * @param {string?} params.CustomerType
 */
export async function loadHeldOrders(params) {
    // debug('loadHeldOrders()', params);
    let filter = queryFilters(params);
    let groupBy = 'o.ARDivisionNo';
    let key = 'ARDivisionNo';

    switch (params.totalBy) {
    case 'ARDivisionNo':
        groupBy = 'c.ARDivisionNo';
        key = 'c.ARDivisionNo';
        break;
    case 'CustomerType':
        groupBy = 'c.ARDivisionNo, c.CustomerType';
        key = 'CustomerType';
        break;
    case 'CustomerNo':
        groupBy = 'c.ARDivisionNo, c.CustomerNo, c.CustomerName, c.CreditHold';
        key = 'CustomerNo';
        break;
    case 'SalesOrderNo':
        groupBy = 'o.SalesOrderNo, o.ShipExpireDate, o.OrderType, o.BillToName, o.ShipToCode, o.ShipToName, o.CustomerPONo';
        key = 'SalesOrderNo';
        break;
    }

    const query = `SELECT ${groupBy}, SUM(o.TaxableAmt + o.NonTaxableAmt - o.DiscountAmt) AS HeldOrderTotal
                   FROM AR_Customer c,
                        SO_SalesOrderHeader o
                   WHERE c.ARDivisionNo = o.ARDivisionNo
                     AND c.CustomerNo = o.CustomerNo
                     AND (
                           (o.OrderType <> 'Q' AND o.OrderType <> 'M')
                           AND (o.OrderStatus = 'H' OR c.CreditHold = 'Y')
                           AND (o.ShipExpireDate <= {d :maxDate})
                           AND (o.CurrentInvoiceNo IS NULL)
                       )
                       ${filter.query}
                   GROUP BY ${groupBy}`;
    const data = {...filter.data, maxDate: params.maxDate};

    try {
        const connection = await sageOdbc.getConnection(params.company);
        const {records} = await connection.query(query, data);
        return {field: 'HeldOrderTotal', key, records};
    } catch (err) {
        debug("loadHeldOrders()", err.message);
        return Promise.reject(err);
    }
}
