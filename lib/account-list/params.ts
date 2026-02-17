import dayjs from 'dayjs';
import {
    AccountListBody,
    AccountListTitles,
    ParsedBody,
    SalesP1TitleProps,
    SalesP2TitleProps,
    SalesP3TitleProps,
    SalesP4TitleProps,
    SalesP5TitleProps
} from "./account-list-types.js";

const mysqlFormat = 'YYYY-MM-DD';


export const parse = (body: AccountListBody, userId: number): ParsedBody => {
    const {fields, filters, periods, sort} = body;
    filters.userId = userId;
    filters.SalesP1 = fields.includes('SalesP1') ? 1 : 0;
    filters.SalesP2 = fields.includes('SalesP2') ? 1 : 0;
    filters.SalesP3 = fields.includes('SalesP3') ? 1 : 0;
    filters.SalesP4 = fields.includes('SalesP4') ? 1 : 0;
    filters.SalesP5 = fields.includes('SalesP5') ? 1 : 0;
    filters.top = Number(filters.top || 10000);
    filters.DateCreatedMin = filters.DateCreatedMin ? dayjs(filters.DateCreatedMin).format(mysqlFormat) : null;
    filters.DateCreatedMax = filters.DateCreatedMax ? dayjs(filters.DateCreatedMax).format(mysqlFormat) : null;
    filters.DateLastActivityMin = filters.DateLastActivityMin ? dayjs(filters.DateLastActivityMin).format(mysqlFormat) : null;
    filters.DateLastActivityMax = filters.DateLastActivityMax ? dayjs(filters.DateLastActivityMax).format(mysqlFormat) : null;

    periods.p1MinDate = periods.p1MinDate ? dayjs(periods.p1MinDate).format(mysqlFormat) : null;
    periods.p1MaxDate = periods.p1MaxDate ? dayjs(periods.p1MaxDate).format(mysqlFormat) : null;
    periods.p2MinDate = periods.p2MinDate ? dayjs(periods.p2MinDate).format(mysqlFormat) : null;
    periods.p2MaxDate = periods.p2MaxDate ? dayjs(periods.p2MaxDate).format(mysqlFormat) : null;
    periods.p3MinDate = periods.p3MinDate ? dayjs(periods.p3MinDate).format(mysqlFormat) : null;
    periods.p3MaxDate = periods.p3MaxDate ? dayjs(periods.p3MaxDate).format(mysqlFormat) : null;
    periods.p4MinDate = periods.p4MinDate ? dayjs(periods.p4MinDate).format(mysqlFormat) : null;
    periods.p4MaxDate = periods.p4MaxDate ? dayjs(periods.p4MaxDate).format(mysqlFormat) : null;
    periods.p5MinDate = periods.p5MinDate ? dayjs(periods.p5MinDate).format(mysqlFormat) : null;
    periods.p5MaxDate = periods.p5MaxDate ? dayjs(periods.p5MaxDate).format(mysqlFormat) : null;

    const sqlSort = sort.map(field => `${field.field} ${field.asc ? 'ASC' : 'DESC'}`).join(', ');

    return {fields, filters, periods, sqlSort};
};

function formatDateRange(min: string|null|undefined, max: string|null|undefined) {
    if (!min || !max) return 'N/A';
    const minDate = dayjs(min);
    const maxDate = dayjs(max);
    if (minDate.isSame(maxDate, 'year')) {
        return `${minDate.format('DD MMM')} - ${maxDate.format('DD MMM YYYY')}`;
    }
    return `${minDate.format('DD MMM YYYY')} - ${maxDate.format('DD MMM YYYY')}`;
}

export const titles: AccountListTitles = {
    dataTitles: {
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
        // fax: () => 'Fax',
        account: () => 'Customer #',
        ShipToCode: () => 'ShipTo',
        AddressLine1: () => 'Address 1',
        AddressLine2: () => 'Address 2',
        AddressLine3: () => 'Address 3',
        DateLastActivity: () => 'Last Activity',
        // FaxNo: () => 'Fax',
        // isb2b: () => 'B2B Account',
    },
    periodTitles: {
        SalesP1: ({p1MinDate, p1MaxDate}: SalesP1TitleProps) => formatDateRange(p1MinDate, p1MaxDate),
        SalesP2: ({p2MinDate, p2MaxDate}: SalesP2TitleProps) => formatDateRange(p2MinDate, p2MaxDate),
        SalesP3: ({p3MinDate, p3MaxDate}: SalesP3TitleProps) => formatDateRange(p3MinDate, p3MaxDate),
        SalesP4: ({p4MinDate, p4MaxDate}: SalesP4TitleProps) => formatDateRange(p4MinDate, p4MaxDate),
        SalesP5: ({p5MinDate, p5MaxDate}: SalesP5TitleProps) => formatDateRange(p5MinDate, p5MaxDate),
    }
    // acct: () => 'Customer #',
};

export const columns = {};
