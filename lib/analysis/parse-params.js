import Debug from "debug";
import dayjs from "dayjs";
import { convertString } from './convertToRegex.js';
const debug = Debug('chums:lib:analysis:query-handler');
export function parseSortField(sortField) {
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
export function parseRequestParams({ query, body }) {
    const { company, ARDivisionNo, CustomerNo = '', ShipToCode, created_min: minCreatedDate, created_max: maxCreatedDate, SalespersonNo, CustomerType, CustomerGroup, State, ShipToState, SalesAccount, CostAccount, ProductLine, Category2, Category3, BaseSKU, ItemCode, ProductStatus, PrimaryVendorNo, countryOfOrigin, p1min, p1max, p2min, p2max, limit, method, 'include-open-orders': openorders, 'include-discounts': discounts, SortField, sort, strictFilter } = { ...body, ...query };
    const [_ARDivisionNo, _CustomerNo] = /^[0-9]{2}-[A-Z0-9]+$/.test((CustomerNo ?? '').trim().toUpperCase())
        ? (CustomerNo ?? '').split('-')
        : [];
    const strict = strictFilter === '1';
    return {
        discounts: !!discounts ? '1' : '',
        openOrders: !!openorders ? '1' : '',
        p1min: dayjs(p1min).format('YYYY-MM-DD'),
        p1max: dayjs(p1max).format('YYYY-MM-DD'),
        p2min: dayjs(p2min).format('YYYY-MM-DD'),
        p2max: dayjs(p2max).format('YYYY-MM-DD'),
        ARDivisionNo: convertString(_ARDivisionNo ?? ARDivisionNo, strict) || null,
        CustomerNo: convertString(_CustomerNo ?? CustomerNo, strict) || null,
        ShipToCode: convertString(ShipToCode, strict) || null,
        SalespersonNo: convertString(SalespersonNo, strict) || null,
        CustomerType: convertString(CustomerType, strict) || null,
        CustomerGroup: convertString(CustomerGroup, strict) || null,
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
        minCreatedDate: minCreatedDate ?? null,
        maxCreatedDate: maxCreatedDate ?? null,
    };
}
