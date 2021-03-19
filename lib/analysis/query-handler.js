const debug = require('debug')('chums:lib:analysis:query-handler');
const {mysql2Pool, parseSQL} = require('chums-local-modules');
const format = require('date-fns/format');
const parseISO = require('date-fns/parseISO');
const {convertString, convertObjectValues} = require('./convertToRegex');

const division = require('./division-queries');
const customer = require('./customer-queries');
const shipTo = require('./ship-to-queries');
const month = require('./month-queries');
const rep = require('./rep-queries');
const salesGL = require('./sales-gl-queries');
const costGL = require('./cost-gl-queries');
const prodLine = require('./product-line-queries');
const itemCategory = require('./item-category-queries');
const itemCategory3 = require('./item-category3-queries');
const itemCountryOrigin = require('./item-country-origin-queries');
const itemVendor = require('./item-vendor-queries');
const itemBaseSKU = require('./item-base-sku-queries');
const itemCode = require('./item-queries');
const shipToState = require('./ship-to-state-queries');
const billToState = require('./bill-to-state-queries');

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
    } = {...body, ...query};

    const [_ARDivisionNo, _CustomerNo] = /^[0-9]{2}-[A-Z0-9]+$/.test(CustomerNo.trim().toUpperCase())
        ? CustomerNo.split('-')
        : [];

    return {
        discounts: !!discounts,
        openOrders: !!openorders,
        company,
        p1min: parseISO(p1min),
        p1max: parseISO(p1max),
        p2min: parseISO(p2min),
        p2max: parseISO(p2max),
        ARDivisionNo: convertString(_ARDivisionNo || ARDivisionNo) || null,
        CustomerNo: convertString(_CustomerNo || CustomerNo) || null,
        ShipToCode: convertString(ShipToCode) || null,
        SalespersonNo: convertString(SalespersonNo) || null,
        CustomerType: convertString(CustomerType) || null,
        State: convertString(State || '') || null,
        ShipToState: convertString(ShipToState) || null,
        ItemCode: convertString(ItemCode) || null,
        SalesAccount: convertString(SalesAccount) || null,
        CostAccount: convertString(CostAccount) || null,
        ProductLine: convertString(ProductLine) || null,
        Category2: convertString(Category2) || null,
        Category3: convertString(Category3) || null,
        BaseSKU: convertString(BaseSKU) || null,
        PrimaryVendorNo: convertString(PrimaryVendorNo) || null,
        CountryOfOrigin: convertString(countryOfOrigin) || null,
        ProductStatus: convertString(ProductStatus) || null,
        SortField: parseSortField(SortField),
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
        const query = queryFunction(params);
        const [rows] = await mysql2Pool.query(query, params);
        rows.forEach(row => {
            row.p1_shipped = Number(row.p1_shipped);
            row.p1_shipped += params.openOrders ? Number(row.p1_open) : 0;
            
            row.p1_sales = Number(row.p1_sales);
            row.p1_sales += params.openOrders ? Number(row.p1_open_sales) : 0;
            row.p1_sales -= params.discounts ? Number(row.p1_discount) : 0;

            row.p1_cogs = Number(row.p1_cogs);
            row.p1_cogs += params.openOrders ? Number(row.p1_open_cogs) : 0;
            
            row.p1_revenue = row.p1_sales - row.p1_cogs;
            row.p1_margin = row.p1_sales === 0 ? 0 : row.p1_revenue / row.p1_sales;
            
            delete row.p1_open;
            delete row.p1_open_cogs;
            delete row.p1_open_sales;
            delete row.p1_discount;

            row.p2_shipped = Number(row.p2_shipped);
            row.p2_shipped += params.openOrders ? Number(row.p2_open) : 0;
            
            row.p2_sales = Number(row.p2_sales);
            row.p2_sales += params.openOrders ? Number(row.p2_open_sales) : 0;
            row.p2_sales -= params.discounts ? Number(row.p2_discount) : 0;

            row.p2_cogs = Number(row.p2_cogs);
            row.p2_cogs += params.openOrders ? Number(row.p2_open_cogs) : 0;

            row.p2_revenue = row.p2_sales - row.p2_cogs;
            row.p2_margin = row.p2_sales === 0 ? 0 : row.p2_revenue / row.p2_sales;
            
            
            delete row.p2_open;
            delete row.p2_open_cogs;
            delete row.p2_open_sales;
            delete row.p2_discount;
            
        })
        return {query: parseSQL(query, params), rows};
    } catch(err) {
        debug("loadDivisions()", err.message);
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

    } catch(err) {
        debug("buildQuery()", err.message);
        return Promise.reject(err);
    }
}

async function getDivision(req, res) {
    const params = parseParams(req);
    try {
        const result = await execQuery(params);
        res.json({params, ...result});
    } catch(err) {
        debug("getDivision()", err.message);
        res.status(500).json({error: err.message, params, query: ''});
    }
}
exports.getDivision = getDivision;
