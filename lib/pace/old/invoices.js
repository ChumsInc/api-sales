/**
 * Created by steve on 12/15/2016.
 */
import Debug from 'debug';
import {queryFilters} from '../utils.js';
import {sageOdbc} from 'chums-base';

const debug = Debug('chums:api:sales:pace5:invoices');


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
export async function loadInvoiced(params) {

    try {
        // debug('loadInvoiced()', params);
        // const dsn = DSN.get(params.company);
        // const connection = ADODB.open(dsn);
        let filter = queryFilters(params);
        let groupBy = 'c.ARDivisionNo';
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
            groupBy = 'h.InvoiceNo, h.SalesOrderNo, h.InvoiceDate, h.BillToName, h.ShipToCode, h.ShipToName, h.CustomerPONo';
            key = 'InvoiceNo';
            break;
        }

        const query = `SELECT ${groupBy}, SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvTotal
                       FROM AR_InvoiceHistoryHeader h,
                            AR_Customer c
                       WHERE c.ARDivisionNo = h.ARDivisionNo
                         AND c.CustomerNo = h.CustomerNo
                         AND h.InvoiceDate <= {d :maxDate}
                         AND h.InvoiceDate >= {d :minDate} ${filter.query}
		AND InvoiceType <> 'XD'
                       GROUP BY ${groupBy}`;
        const data = {...filter.data, maxDate: params.maxDate, minDate: params.minDate};
        // debug('loadInvoiced()', {query});
        const connection = await sageOdbc.getConnection(params.company);
        const {records} = await connection.query(query, data);
        return {field: 'InvTotal', key, records};
    } catch (err) {
        debug("loadInvoiced()", err.message, query, data);
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
export async function loadCurrentInvoices(params) {
    // debug('loadCurrentInvoices()', params);
    let filter = queryFilters(params);
    let groupBy = 'c.ARDivisionNo';
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
        groupBy = 'h.InvoiceNo, h.SalesOrderNo, h.InvoiceDate, h.BillToName, h.ShipToCode, h.ShipToName, h.CustomerPONo';
        key = 'InvoiceNo';
        break;
    }

    const queryNew = `SELECT ${groupBy}, SUM(TaxableAmt + NonTaxableAmt - DiscountAmt) AS InvTotal
                      FROM SO_InvoiceHeader h,
                           AR_Customer c,
                           GL_CompanyActiveBatch b
                      WHERE c.ARDivisionNo = h.ARDivisionNo
                        AND c.CustomerNo = h.CustomerNo
                        AND InvoiceDate <= {d :maxDate}
                        AND InvoiceDate >= {d :minDate}
                        AND b.BatchNo = h.BatchNo
                        AND b.PrivateBatch <> 'Y'
                          ${filter.query}
                        AND InvoiceType <> 'XD'
                      GROUP BY ${groupBy}`;

    const query = `SELECT ${groupBy}, SUM(TaxableAmt + NonTaxableAmt - DiscountAmt) AS InvTotal
                   FROM SO_InvoiceHeader h,
                        AR_Customer c
                   WHERE c.ARDivisionNo = h.ARDivisionNo
                     AND c.CustomerNo = h.CustomerNo
                     AND InvoiceDate <= {d :maxDate}
                     AND InvoiceDate >= {d :minDate} ${filter.query}
		AND InvoiceType <> 'XD'
                   GROUP BY ${groupBy}`;
    const data = {...filter.data, maxDate: params.maxDate, minDate: params.minDate};
    try {
        const connection = await sageOdbc.getConnection(params.company);
        const {records} = await connection.query(query, data);
        return {field: 'InvTotal', key, records};
    } catch (err) {
        debug("loadCurrentInvoices()", err.message);
        return Promise.reject(err);
    }
}
