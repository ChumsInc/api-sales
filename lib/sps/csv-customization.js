function parseCustomerAccount ({ARDivisionNo = '', CustomerNo = ''}) {
    return [ARDivisionNo, CustomerNo].join('-');
}

/**
 * This function should return only new or changed fields to the SalesOrder
 *
 * @param {Object} customer
 * @param {String} customer.ARDivisionNo
 * @param {String} customer.CustomerNo
 * @param {Object} header
 * @param {Object} csvLine
 * @return {Object}
 */
exports.updateCustomHeader = (customer, header, csvLine) => {
    const acct = parseCustomerAccount(customer);
    switch (acct) {
    case '01-TEST': // as en example;
        return {
            SalespersonDivisionNo: '01',
            SalespersonNo: 'TEST'
        };
    case '02-IL0010':
        return {};
    default:
        return {};
    }
};

/**
 * This function should remove only changed fields to the SalesOrder Detail Line
 * @param {Object} customer
 * @param {String} customer.ARDivisionNo
 * @param {String} customer.CustomerNo
 * @param {Object} line
 * @param {Object} csvLine
 * @return {Object}
 */
exports.updateCustomDetail = (customer, line, csvLine) => {
    const acct = parseCustomerAccount(customer);
    switch (acct) {
    case '02-IL0010':
        return {
            CommentText: `Grainger Item: ${csvLine['Buyers Catalog or Stock Keeping #']}`
        };
    default:
        return {};
    }
};
