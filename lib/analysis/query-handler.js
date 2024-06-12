import Debug from "debug";
import {mysql2Pool, parseSQL} from 'chums-local-modules';
import {parseISO} from 'date-fns';
import dayjs from "dayjs";
import {convertString} from './convertToRegex.js';
import * as division from './division-queries.js';
import * as customer from './customer-queries.js';
import * as shipTo from './ship-to-queries.js';
import * as month from './month-queries.js';
import * as rep from './rep-queries.js';
import * as salesGL from './sales-gl-queries.js';
import * as costGL from './cost-gl-queries.js';
import * as prodLine from './product-line-queries.js';
import * as itemCategory from './item-category-queries.js';
import * as itemCategory3 from './item-category3-queries.js';
import * as itemCountryOrigin from './item-country-origin-queries.js';
import * as itemVendor from './item-vendor-queries.js';
import * as itemBaseSKU from './item-base-sku-queries.js';
import * as itemCode from './item-queries.js';
import * as shipToState from './ship-to-state-queries.js';
import * as billToState from './bill-to-state-queries.js';
import * as customerType from './customer-type-queries.js';
import Decimal from 'decimal.js';

const debug = Debug('chums:lib:analysis:query-handler');

function parseSortField(sortField) {
    switch (sortField) {
        case 'sales':
            return ['p1_sales DESC', 'p2_sales DESC'];
        case 'units':
            return ['p1_shipped DESC', 'p2_shipped DESC'];
        case 'cogs':
            return ['p1_cogs DESC', 'p2_cogs DESC'];
        case 'revenue':
            return ['p1_revenue DESC', 'p2_revenue DESC'];
        case 'margin':
            return ['p1_margin DESC', 'p2_margin DESC'];
        default:
            return ['key_field'];
    }
}

function parseParams({query, body}) {
    const {
        company,
        ARDivisionNo,
        CustomerNo = '',
        ShipToCode,
        created_min: minCreatedDate,
        created_max: maxCreatedDate,
        SalespersonNo,
        CustomerType,
        State,
        ShipToState,
        SalesAccount,
        CostAccount,
        ProductLine,
        Category2,
        Category3,
        BaseSKU,
        ItemCode,
        ProductStatus,
        PrimaryVendorNo,
        countryOfOrigin,
        p1min,
        p1max,
        p2min,
        p2max,
        limit,
        method,
        'include-open-orders': openorders,
        'include-discounts': discounts,
        SortField,
        sort,
        strictFilter
    } = {...body, ...query};

    const [_ARDivisionNo, _CustomerNo] = /^[0-9]{2}-[A-Z0-9]+$/.test(CustomerNo.trim().toUpperCase())
        ? CustomerNo.split('-')
        : [];

    const strict = strictFilter === '1';

    return {
        discounts: !!discounts ? '1' : '',
        openOrders: !!openorders ? '1' : '',
        company,
        p1min: dayjs(p1min).format('YYYY-MM-DD'),
        p1max: dayjs(p1max).format('YYYY-MM-DD'),
        p2min: dayjs(p2min).format('YYYY-MM-DD'),
        p2max: dayjs(p2max).format('YYYY-MM-DD'),
        ARDivisionNo: convertString(_ARDivisionNo || ARDivisionNo, strict) || null,
        CustomerNo: convertString(_CustomerNo || CustomerNo, strict) || null,
        ShipToCode: convertString(ShipToCode, strict) || null,
        SalespersonNo: convertString(SalespersonNo, strict) || null,
        CustomerType: convertString(CustomerType, strict) || null,
        State: convertString(State || '', strict) || null,
        ShipToState: convertString(ShipToState, strict) || null,
        ItemCode: convertString(ItemCode, strict) || null,
        SalesAccount: convertString(SalesAccount, strict) || null,
        CostAccount: convertString(CostAccount, strict) || null,
        ProductLine: convertString(ProductLine, strict) || null,
        Category2: convertString(Category2, strict) || null,
        Category3: convertString(Category3, strict) || null,
        BaseSKU: convertString(BaseSKU, strict) || null,
        PrimaryVendorNo: convertString(PrimaryVendorNo, strict) || null,
        CountryOfOrigin: convertString(countryOfOrigin, strict) || null,
        ProductStatus: convertString(ProductStatus, strict) || null,
        SortField: parseSortField(sort),
        limit: Number(limit || 9999),
        method,
        minCreatedDate,
        maxCreatedDate,
    }
}

/**
 *
 * @param {function} queryFunction
 * @param {object} params
 * @returns {Promise<{query, rows: *}>}
 */
async function loadResults(queryFunction, params) {
    try {
        // debug('loadResults()', params);
        const query = queryFunction(params);
        const [rows] = await mysql2Pool.query(query, params);
        return {
            query: parseSQL(query, params),
            rows: rows.map(row => {
                const p1_shipped = new Decimal(row.p1_shipped).add(params.openOrders ? row.p1_open : 0);
                const p1_sales = new Decimal(row.p1_sales).add(params.openOrders ? row.p1_open_sales : 0).sub(params.discounts ? row.p1_discount : 0);
                const p1_cogs = new Decimal(row.p1_cogs).add(params.openOrders ? row.p1_open_cogs : 0);
                const p1_revenue = p1_sales.sub(p1_cogs);
                const p1_margin = p1_sales.eq(0) ? new Decimal(0) : p1_revenue.div(p1_sales);

                const p2_shipped = new Decimal(row.p2_shipped).add(params.openOrders ? row.p2_open : 0);
                const p2_sales = new Decimal(row.p2_sales).add(params.openOrders ? row.p2_open_sales : 0).sub(params.discounts ? row.p2_discount : 0);
                const p2_cogs = new Decimal(row.p2_cogs).add(params.openOrders ? row.p2_open_cogs : 0);
                const p2_revenue = p2_sales.sub(p2_cogs);
                const p2_margin = p2_sales.eq(0) ? new Decimal(0) : p2_revenue.div(p2_sales);

                return {
                    ...row,
                    p1_shipped: p1_shipped.toString(),
                    p1_sales: p1_sales.toString(),
                    p1_cogs: p1_cogs.toString(),
                    p1_revenue: p1_revenue.toString(),
                    p1_margin: p1_margin.toString(),
                    p2_shipped: p2_shipped.toString(),
                    p2_sales: p2_sales.toString(),
                    p2_cogs: p2_cogs.toString(),
                    p2_revenue: p2_revenue.toString(),
                    p2_margin: p2_margin.toString(),
                }
            })};
    } catch (err) {
        debug("loadResults()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param params
 * @returns {Promise<{query, rows: *}|{query: string, rows: []}>}
 */
async function execQuery(params) {
    try {
        switch (params.method) {
            case 'ARDivisionNo':
                return await loadResults(division.buildQuery, params);
            case 'CustomerNo':
                return await loadResults(customer.buildQuery, params);
            case 'ShipToCode':
                return await loadResults(shipTo.buildQuery, params);
            case 'BillToState':
                return await loadResults(billToState.buildQuery, params);
            case 'ShipToState':
                return await loadResults(shipToState.buildQuery, params);
            case 'CustomerType':
                return await loadResults(customerType.buildQuery, params);
            case 'month':
                return await loadResults(month.buildQuery, params);
            case 'SalespersonNo':
                return await loadResults(rep.buildQuery, params);
            case 'SalesGLAccount':
                return await loadResults(salesGL.buildQuery, params);
            case 'CostGLAccount':
                return await loadResults(costGL.buildQuery, params);
            case 'ProductLine':
                return await loadResults(prodLine.buildQuery, params);
            case 'Category2':
                return await loadResults(itemCategory.buildQuery, params);
            case 'Category3':
                return await loadResults(itemCategory3.buildQuery, params);
            case 'CountryOfOrigin':
                return await loadResults(itemCountryOrigin.buildQuery, params);
            case 'PrimaryVendorNo':
                return await loadResults(itemVendor.buildQuery, params);
            case 'BaseSKU':
                return await loadResults(itemBaseSKU.buildQuery, params);
            case 'ItemCode':
                return await loadResults(itemCode.buildQuery, params);
            default:
                return {query: 'not defined', rows: []};
        }

    } catch (err) {
        debug("buildQuery()", err.message);
        return Promise.reject(err);
    }
}

export async function getSalesAnalysis(req, res) {
    const params = parseParams(req);
    try {
        const result = await execQuery(params);
        res.json({params, ...result});
    } catch (err) {
        debug("getDivision()", err.message);
        res.status(500).json({error: err.message, params, query: ''});
    }
}
