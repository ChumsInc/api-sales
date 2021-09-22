/**
 *
 * @param {string} query
 * @param {Object} [options]
 * @param {boolean} [options.discounts]
 * @param {boolean} [options.openOrders]
 * @param {string[]} [options.SortField]
 * @param {string} qryInvoicedP1
 * @param {string} qryInvoicedP2
 * @param {string} [qryInvoiceDiscountP1]
 * @param {string} [qryInvoiceDiscountP2]
 * @param {string} [qryOpenP1]
 * @param {string} [qryOpenP2]
 * @returns {string}
 */
exports.combineQueries = ({
                              query,
                              options = {},
                              qryInvoicedP1,
                              qryInvoicedP2,
                              qryInvoiceDiscountP1 = '',
                              qryInvoiceDiscountP2 = '',
                              qryOpenP1 = '',
                              qryOpenP2 = '',
                          }) => {
    if (!options.SortField || options.SortField.length === 0) {
        options.SortField = ['key_field'];
    }

    const subQueries = [
        qryInvoicedP1,
        qryInvoicedP2,
    ]
    if (options.discounts) {
        subQueries.push(...[qryInvoiceDiscountP1, qryInvoiceDiscountP2]);
    }
    if (options.openOrders) {
        subQueries.push(...[qryOpenP1, qryOpenP2]);
    }
    return query
        .replace('$SUB_QUERIES$', subQueries.join("\n\nUNION ALL\n\n"))
        .replace('$ORDER_BY$', options.SortField.join(', '))
        .trim();
}
