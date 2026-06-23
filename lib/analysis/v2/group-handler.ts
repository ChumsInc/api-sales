import Debug from "debug";
import {SAParams, SAQueryResult} from "../sa-types.js";
import {loadARDivisionResults} from "./group-by-division.js";
import {loadCustomerResults} from "./group-by-customer.js";
import {loadShipToResults} from "./group-by-shipto.js";
import {loadCustomerLocationResults} from "./group-by-customer-location.js";
import {loadShipToLocationResults} from "./group-by-shipto-location.js";
import {loadMonthResults} from "./group-by-month.js";
import {loadCustomerTypeResults} from "./group-by-customer-type.js";
import {loadCustomerGroupResults} from "./group-by-customer-group.js";
import {loadSalespersonResults} from "./group-by-salesperson.js";
import {loadItemCodeResults} from "./group-by-item-code.js";
import {loadBaseSKUResults} from "./group-by-item-base-sku.js";
import {loadProductLineResults} from "./group-by-item-product-line.js";
import {loadItemCategoryResults} from "./group-by-item-category.js";
import {loadItemCollectionResults} from "./group-by-item-collection.js";
import {loadItemCountryResults} from "./group-by-item-country.js";
import {loadItemVendorResults} from "./group-by-item-vendor.js";
import {loadItemSalesGLResults} from "./group-by-item-sales-gl.js";
import {loadItemCostGLResults} from "./group-by-item-cost-gl.js";

const debug = Debug('chums:lib:analysis:v2:group-handler');

export async function loadResults(params: SAParams, skipExec?: boolean): Promise<SAQueryResult> {
    try {
        switch (params.method) {
            case 'ARDivisionNo':
                return await loadARDivisionResults(params, skipExec);
            case 'CustomerNo':
                return await loadCustomerResults(params, skipExec);
            case 'ShipToCode':
                return await loadShipToResults(params, skipExec);
            case 'BillToState':
                return await loadCustomerLocationResults(params, skipExec);
            case 'ShipToState':
                return await loadShipToLocationResults(params, skipExec);
            case 'month':
                return await loadMonthResults(params, skipExec);
            case 'CustomerType':
                return await loadCustomerTypeResults(params, skipExec);
            case 'CustomerGroup':
                return await loadCustomerGroupResults(params, skipExec);
            case 'SalespersonNo':
                return await loadSalespersonResults(params, skipExec);
            case 'ItemCode':
                return await loadItemCodeResults(params, skipExec);
            case 'BaseSKU':
                return await loadBaseSKUResults(params, skipExec);
            case 'ProductLine':
                return await loadProductLineResults(params, skipExec);
            case 'Category2':
                return await loadItemCategoryResults(params, skipExec);
            case 'Category3':
                return await loadItemCollectionResults(params, skipExec);
            case 'CountryOfOrigin':
                return await loadItemCountryResults(params, skipExec);
            case 'PrimaryVendorNo':
                return await loadItemVendorResults(params, skipExec);
            case 'SalesGLAccount':
                return await loadItemSalesGLResults(params, skipExec);
            case 'CostGLAccount':
                return await loadItemCostGLResults(params, skipExec);
            default:
                return {query: 'not defined', rows: [], error: `Query not defined: ${params.method}`};
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadResults()", err.message);
            return Promise.reject(err);
        }
        debug("loadResults()", err);
        return Promise.reject(new Error('Error in loadResults()'));
    }
}
