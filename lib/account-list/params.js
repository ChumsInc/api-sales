import {format, parseISO} from 'date-fns';
import Debug from "debug";

const debug = Debug('chums:lib:account-list:params');

const mysqlFormat = 'yyyy-MM-dd';

/**
 *
 * @param body
 * @param user
 * @return {Promise<{sqlSort: *, periods, filters, fields}>}
 */
export const parse = async (body, user) => {
    try {
        const {fields, filters, periods, sort} = body;
        filters.userId = user.id || 0;
        filters.SalesP1 = fields.includes('SalesP1') ? 1 : 0;
        filters.SalesP2 = fields.includes('SalesP2') ? 1 : 0;
        filters.SalesP3 = fields.includes('SalesP3') ? 1 : 0;
        filters.SalesP4 = fields.includes('SalesP4') ? 1 : 0;
        filters.SalesP5 = fields.includes('SalesP5') ? 1 : 0;
        filters.top = Number(filters.top || 10000);
        filters.DateCreatedMin = !!filters.DateCreatedMin ? format(parseISO(filters.DateCreatedMin), mysqlFormat) : null;
        filters.DateCreatedMax = !!filters.DateCreatedMax ? format(parseISO(filters.DateCreatedMax), mysqlFormat) : null;
        filters.DateLastActivityMin = !!filters.DateLastActivityMin ? format(parseISO(filters.DateLastActivityMin), mysqlFormat) : null;
        filters.DateLastActivityMax = !!filters.DateLastActivityMax ? format(parseISO(filters.DateLastActivityMax), mysqlFormat) : null;

        periods.p1MinDate = !!periods.p1MinDate ? format(parseISO(periods.p1MinDate), mysqlFormat) : null;
        periods.p1MaxDate = !!periods.p1MaxDate ? format(parseISO(periods.p1MaxDate), mysqlFormat) : null;
        periods.p2MinDate = !!periods.p2MinDate ? format(parseISO(periods.p2MinDate), mysqlFormat) : null;
        periods.p2MaxDate = !!periods.p2MaxDate ? format(parseISO(periods.p2MaxDate), mysqlFormat) : null;
        periods.p3MinDate = !!periods.p3MinDate ? format(parseISO(periods.p3MinDate), mysqlFormat) : null;
        periods.p3MaxDate = !!periods.p3MaxDate ? format(parseISO(periods.p3MaxDate), mysqlFormat) : null;
        periods.p4MinDate = !!periods.p4MinDate ? format(parseISO(periods.p4MinDate), mysqlFormat) : null;
        periods.p4MaxDate = !!periods.p4MaxDate ? format(parseISO(periods.p4MaxDate), mysqlFormat) : null;
        periods.p5MinDate = !!periods.p5MinDate ? format(parseISO(periods.p5MinDate), mysqlFormat) : null;
        periods.p5MaxDate = !!periods.p5MaxDate ? format(parseISO(periods.p5MaxDate), mysqlFormat) : null;

        const sqlSort = sort.map(field => `${field.field} ${field.asc ? 'ASC' : 'DESC'}`).join(', ');

        return {fields, filters, periods, sqlSort};
    } catch (err) {
        debug("parse()", err.message);
        return Promise.reject(err);
    }
};

// exports.sortFields = {
//     p1: 'abs(p1)',
//     p2: 'abs(p2)',
//     p3: 'abs(p3)',
//     acct: 'account',
//     name: 'CustomerName',
//     city: 'City',
//     state: 'State',
//     country: 'CountryCode',
//     zip: 'ZipCode',
//     rep: 'RepNo',
//     type: 'CustomerType',
//     pricelvl: 'PriceLevel',
//     email: 'EmailAddress',
//     created: 'DateCreated',
//     lastactivity: 'DateLastActivity',
//     isb2b: 'isb2b',
// };
//
//
// exports.fields = {
//     account: ['account'],
//     p1: ['p1'],
//     p2: ['p2'],
//     p3: ['p3'],
//     acct: ['account'],
//     name: ['CustomerName'],
//     addr: ['AddressLine1', 'AddressLine2', 'AddressLine3'],
//     city: ['City'],
//     state: ['State'],
//     country: ['CountryCode'],
//     zip: ['ZipCode'],
//     rep: ['repno'],
//     repname: ['SalespersonName'],
//     type: ['CustomerType'],
//     pricelvl: ['PriceLevel'],
//     email: ['EmailAddress'],
//     created: ['DateCreated'],
//     lastactivity: ['DateLastActivity'],
//     phone: ['TelephoneNo'],
//     fax: ['FaxNo'],
//     ARDivisionNo: ['ARDivisionNo'],
//     CustomerNo: ['CustomerNo'],
//     ShipToCode: ['ShipToCode'],
//     SalespersonDivisionNo: ['SalespersonDivisionNo'],
//     SalespersonNo: ['SalespersonNo'],
//     isb2b: ['isb2b'],
// };

function formatDateRange(min, max) {
    min = parseISO(min);
    max = parseISO(max);
    if (min.getFullYear() === max.getFullYear()) {
        return format(min, 'dd MMM') + ' - ' + format(max, 'dd MMM yyyy');
    }
    return format(min, 'dd MMM yyyy')
        + ' - '
        + format(max, 'dd MMM yyyy')

}

export const titles = {
    SalesP1: ({p1MinDate, p1MaxDate}) => formatDateRange(p1MinDate, p1MaxDate),
    SalesP2: ({p2MinDate, p2MaxDate}) => formatDateRange(p2MinDate, p2MaxDate),
    SalesP3: ({p3MinDate, p3MaxDate}) => formatDateRange(p3MinDate, p3MaxDate),
    SalesP4: ({p4MinDate, p4MaxDate}) => formatDateRange(p4MinDate, p4MaxDate),
    SalesP5: ({p5MinDate, p5MaxDate}) => formatDateRange(p5MinDate, p5MaxDate),
    acct: () => 'Customer #',
    ARDivisionNo: () => 'ARDivisionNo',
    CustomerNo: () => 'CustomerNo',
    CustomerName: () => 'Name',
    CustomerAddress: () => 'Address',
    City: () => 'City',
    State: () => 'State',
    CountryCode: () => 'Country',
    ZipCode: () => 'Zip',
    SalespersonNo: () => 'Rep #',
    SalespersonName: () => 'Rep Name',
    CustomerType: () => 'Cust Type',
    PriceLevel: () => 'Price Level',
    EmailAddress: () => 'EMail',
    DateCreated: () => 'Created',
    TelephoneNo: () => 'Phone',
    fax: () => 'Fax',
    account: () => 'Customer #',
    ShipToCode: () => 'ShipTo',
    AddressLine1: () => 'Address 1',
    AddressLine2: () => 'Address 2',
    AddressLine3: () => 'Address 3',
    DateLastActivity: () => 'Last Activity',
    FaxNo: () => 'Fax',
    isb2b: () => 'B2B Account',
};

export const columns = {};
