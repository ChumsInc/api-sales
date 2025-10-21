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
import * as customerGroup from './customer-group-queries.js';
import {SACombineOptions, SAParams, SAQueryResult, SARow, SASectionRow} from "./sa-types.js";
import {mysql2Pool, parseSQL} from "chums-local-modules";
import Decimal from "decimal.js";
import Debug from "debug";

const debug = Debug('chums:lib:analysis:db-handlers');

export async function buildSQL(params: SACombineOptions): Promise<string> {
    switch (params.method) {
        case 'ARDivisionNo':
            return division.buildQuery(params);
        case 'CustomerNo':
            return customer.buildQuery(params);
        case 'ShipToCode':
            return shipTo.buildQuery(params);
        case 'BillToState':
            return billToState.buildQuery(params);
        case 'ShipToState':
            return shipToState.buildQuery(params);
        case 'CustomerType':
            return customerType.buildQuery(params);
        case 'month':
            return month.buildQuery(params);
        case 'SalespersonNo':
            return rep.buildQuery(params);
        case 'CustomerGroup':
            return customerGroup.buildQuery(params);
        case 'SalesGLAccount':
            return salesGL.buildQuery(params);
        case 'CostGLAccount':
            return costGL.buildQuery(params);
        case 'ProductLine':
            return prodLine.buildQuery(params);
        case 'Category2':
            return itemCategory.buildQuery(params);
        case 'Category3':
            return itemCategory3.buildQuery(params);
        case 'CountryOfOrigin':
            return itemCountryOrigin.buildQuery(params);
        case 'PrimaryVendorNo':
            return itemVendor.buildQuery(params);
        case 'BaseSKU':
            return itemBaseSKU.buildQuery(params);
        case 'ItemCode':
            return itemCode.buildQuery(params);
    }
    return Promise.reject(`Query not defined: ${params.method ?? '--undefined--'}`);
}


async function loadResults<T = SASectionRow>(params: SAParams): Promise<SAQueryResult<T>> {
    try {
        const query = await buildSQL(params);
        const [rows] = await mysql2Pool.query<SARow<T>[]>(query, params);
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
            })
        };
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadResults()", err.message);
            return Promise.reject(err);
        }
        debug("loadResults()", err);
        return Promise.reject(new Error('Error in loadResults()'));
    }
}

export async function execQuery(params: SAParams): Promise<SAQueryResult> {
    try {
        switch (params.method) {
            case 'ARDivisionNo':
            case 'CustomerNo':
            case 'ShipToCode':
            case 'BillToState':
            case 'ShipToState':
            case 'CustomerType':
            case 'CustomerGroup':
            case 'month':
            case 'SalespersonNo':
            case 'SalesGLAccount':
            case 'CostGLAccount':
            case 'ProductLine':
            case 'Category2':
            case 'Category3':
            case 'CountryOfOrigin':
            case 'PrimaryVendorNo':
            case 'BaseSKU':
            case 'ItemCode':
                return await loadResults(params);
            default:
                return {query: 'not defined', rows: [], error: `Query not defined: ${params.method}`};
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("execQuery()", err.message);
            return Promise.reject(err);
        }
        debug("execQuery()", err);
        return Promise.reject(new Error('Error in execQuery()'));
    }
}
