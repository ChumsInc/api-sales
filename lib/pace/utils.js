const {format, parseISO, lastDayOfMonth} =require('date-fns');
/**
 * Created by steve on 12/16/2016.
 */

/**
 *
 * @param {string} year - 4 digit year
 * @param {string} month - 2 digit month ('01' - '12')
 * @return {{minDate: string, maxDate: string}}
 */
function getDates({year, month}) {
    return {
        minDate: format(parseISO(`${year}-${month}-01`), 'yyyy-MM-dd'),
        maxDate: format(lastDayOfMonth(parseISO(`${year}-${month}-01`)), 'yyyy-MM-dd')
    };
}
exports.getDates = getDates;

const queryFilters = function queryFilters(params) {
    let query = '', data = {};

    if (params.ARDivisionNo !== undefined) {
        data.ARDivisionNo = params.ARDivisionNo;
        query += `AND c.ARDivisionNo = :ARDivisionNo `;
    }
    if (params.CustomerNo !== undefined) {
        data.CustomerNo = params.CustomerNo;
        query += `AND c.CustomerNo = :CustomerNo `;
    }
    if (params.CustomerType !== undefined) {
        if (params.CustomerType === '') {
            query += `AND (c.CustomerType = '' OR c.CustomerType IS NULL) `;
        } else if (params.CustomerType === 'HDW' && params.ARDivisionNo === '01') {
            query += `AND (c.CustomerType in ('HDW', 'HDWR', 'HW')) `;
        } else if (params.CustomerType === 'MIL' && params.ARDivisionNo === '01') {
            query += `AND (c.CustomerType in ('GEX', 'MIL', 'PX')) `;
        } else if (params.CustomerType === 'OPT' && params.ARDivisionNo === '01') {
            query += `AND (c.CustomerType in ('OP', 'OPT', 'OPTI')) `;
        } else if (params.CustomerType === 'KEY' && params.ARDivisionNo === '01') {
            query += `AND (c.CustomerType in ('MM', 'MASS', 'KEY')) `;
        } else if (params.CustomerType === 'SPEC' && params.ARDivisionNo === '01') {
            query += `AND (c.CustomerType NOT in ('OP', 'OPT', 'OPTI', 'HDW', 'HDWR', 'HW', 'GEX', 'MIL', 'PX', 'MM', 'MASS', 'KEY') or c.CustomerType is null) `;
        } else {
            data.CustomerType = params.CustomerType;
            query += 'AND c.CustomerType = :CustomerType ';

        }
    }
    return {query, data};
};
exports.queryFilters = queryFilters;
