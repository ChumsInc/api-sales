import {SACombineOptions} from "./sa-types.js";

export interface CombineQueriesParams {
    query: string;
    options: SACombineOptions;
    qryInvoicedP1: string;
    qryInvoicedP2: string;
    qryInvoiceDiscountP1?: string;
    qryInvoiceDiscountP2?: string;
    qryOpenP1?: string;
    qryOpenP2?: string;
}

export const combineQueries = ({
                                   query,
                                   options = {},
                                   qryInvoicedP1,
                                   qryInvoicedP2,
                                   qryInvoiceDiscountP1 = '',
                                   qryInvoiceDiscountP2 = '',
                                   qryOpenP1 = '',
                                   qryOpenP2 = '',
                               }: CombineQueriesParams): string => {
    if (!options.SortField || options.SortField.length === 0) {
        options.SortField = ['key_field'];
    }

    const subQueries = [
        qryInvoicedP1,
        qryInvoicedP2,
    ]
    if (options.discounts && qryInvoiceDiscountP1 && qryInvoiceDiscountP2) {
        subQueries.push(...[qryInvoiceDiscountP1, qryInvoiceDiscountP2]);
    }
    if (options.openOrders && qryOpenP1 && qryOpenP2) {
        subQueries.push(...[qryOpenP1, qryOpenP2]);
    }
    return query
        .replace('$SUB_QUERIES$', subQueries.join("\n\nUNION ALL\n\n"))
        .replace('$ORDER_BY$', options.SortField.join(', '))
        .trim();
}
