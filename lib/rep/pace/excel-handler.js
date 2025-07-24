import Debug from "debug";
import { buildWorkBook, buildXLSXHeaders, resultToExcelSheet } from 'chums-local-modules';
import { loadRepPace, REP_TOTAL } from './reps.js';
import dayjs from "dayjs";
import { Decimal } from "decimal.js";
const debug = Debug('chums:lib:sales:rep:rep-pace');
const REGEX_TITLES = /^[A-Z]+1$/i;
const REGEX_DOLLARS = /^[DEFGHIK]/i;
const REGEX_PCT = /^[J][0-9]+/i;
function parseRep(rep) {
    const { SalespersonDivisionNo, SalespersonNo, SalespersonName } = rep;
    return {
        Salesperson: `${SalespersonDivisionNo}-${SalespersonNo}`,
        SalespersonName,
        ...rep.total,
    };
}
function buildStandardColumns({ minDate, maxDate }) {
    const _fromDate = dayjs(minDate);
    const _toDate = dayjs(maxDate);
    return {
        OpenOrders: 'Open',
        InvCYTD: `${_fromDate.format('MM/DD')}-${_toDate.format('MM/DD/YYYY')}`,
        InvPYTD: `${_fromDate.subtract(1, 'years').format('MM/DD')}-${_toDate.subtract(1, 'years').format('MM/DD/YYYY')}`,
        InvPY: `${_toDate.subtract(1, 'years').format('YYYY')} Total`,
        InvP2TD: `${_fromDate.subtract(2, 'years').format('MM/DD')}-${_toDate.subtract(2, 'years').format('MM/DD/YYYY')}`,
        InvP2: `${_toDate.subtract(2, 'years').format('YYYY')} Total`,
        rate: 'Growth',
        pace: 'Pace',
    };
}
function repReducer(accumulator, currentValue) {
    const acc = { ...accumulator };
    acc.OpenOrders = new Decimal(acc.OpenOrders).add(currentValue.OpenOrders || 0).toString();
    acc.InvCYTD = new Decimal(acc.InvCYTD).add(currentValue.InvCYTD || 0).toString();
    acc.InvPYTD = new Decimal(acc.InvPYTD).add(currentValue.InvPYTD || 0).toString();
    acc.InvPY = new Decimal(acc.InvPY).add(currentValue.InvPY || 0).toString();
    acc.InvP2TD = new Decimal(acc.InvP2TD).add(currentValue.InvP2TD || 0).toString();
    acc.InvP2 = new Decimal(acc.InvP2).add(currentValue.InvP2 || 0).toString();
    acc.rate = new Decimal(acc.InvPYTD).eq(0)
        ? (new Decimal(acc.InvCYTD).eq(0) ? 0 : 1)
        : new Decimal(acc.InvCYTD).sub(acc.InvPYTD).div(acc.InvPYTD).toString();
    acc.pace = new Decimal(acc.InvPY).eq(0)
        ? new Decimal(acc.InvCYTD).add(acc.OpenOrders).toString()
        : new Decimal(acc.rate).add(1).times(acc.InvPY).toString();
    return acc;
}
function repSubRepsTotal(subReps = []) {
    return subReps
        .filter(row => !!row && (row.rep.Active || !new Decimal(row.rep.total.pace ?? '0').eq(0)))
        .map(row => parseRep(row.rep))
        .reduce(repReducer, REP_TOTAL);
}
function repCustomersTotal(repCustomers = []) {
    return repCustomers.reduce(repReducer, REP_TOTAL);
}
function formatWorkSheet(workSheet) {
    const sheet = structuredClone(workSheet);
    Object.keys(sheet)
        .filter(key => !REGEX_TITLES.test(key))
        .filter(key => REGEX_DOLLARS.test(key))
        .forEach(key => {
        sheet[key].z = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
    });
    Object.keys(sheet)
        .filter(key => !REGEX_TITLES.test(key))
        .filter(key => REGEX_PCT.test(key))
        .forEach(key => {
        sheet[key].z = '0%';
    });
    return sheet;
}
async function buildRepTotalSheet(pace, standardColumns) {
    const { Salesperson, SalespersonName, ...repTotal } = parseRep(pace.rep);
    const subRepTotal = repSubRepsTotal(pace.repSubReps);
    const customerTotal = repCustomersTotal(pace.repCustomers);
    const data = [
        { account: 'ALL', name: 'Assigned Reps', email: '', ...subRepTotal },
        { account: 'ALL', name: 'Assigned Customers', email: '', ...customerTotal },
        { account: 'ALL', name: 'Total', email: '', ...repTotal },
    ];
    const workSheet = resultToExcelSheet(data, { account: 'Account', name: 'Group', email: '--', ...standardColumns }, true);
    return formatWorkSheet(workSheet);
}
async function buildSubRepSheet(pace, standardColumns) {
    const subRepTotal = repSubRepsTotal(pace.repSubReps);
    const subRepRows = pace.repSubReps
        .filter(row => !!row && (row.rep.Active || !new Decimal(row.rep.total.pace).eq(0)))
        .map(row => parseRep(row.rep));
    const data = [
        ...subRepRows,
        { ...subRepTotal, Salesperson: 'TOTAL', SalespersonName: '---', EmailAddress: '' },
    ];
    const workSheet = resultToExcelSheet(data, { Salesperson: 'Rep Acct', SalespersonName: 'Rep Name', EmailAddress: 'Email', ...standardColumns }, true);
    return formatWorkSheet(workSheet);
}
async function buildCustomerSheet(pace, standardColumns) {
    const customerTotal = repCustomersTotal(pace.repCustomers);
    const customers = pace.repCustomers.map(customer => {
        const { ARDivisionNo, CustomerNo, CustomerName, EmailAddress, ...rest } = customer;
        return {
            account: `${ARDivisionNo}-${CustomerNo}`,
            name: CustomerName,
            email: EmailAddress ?? '',
            ...rest
        };
    });
    const data = [
        ...customers,
        { account: 'TOTAL', name: '---', ...customerTotal },
    ];
    const workSheet = resultToExcelSheet(data, { account: 'Customer Acct', name: 'Customer Name', email: 'EMail', ...standardColumns }, true);
    return formatWorkSheet(workSheet);
}
export async function getRepPaceXLSX(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const params = {
            ...req.query,
            Company: req.params.Company,
            SalespersonDivisionNo: req.params.SalespersonDivisionNo,
            SalespersonNo: req.params.SalespersonNo,
            minDate: req.params.minDate,
            maxDate: req.params.maxDate,
            groupByCustomer: true,
            userid: res.locals.profile?.user?.id ?? 0,
        };
        const repPace = await loadRepPace(params);
        if (!repPace) {
            return res.json({ repPace: 'no data returned' });
        }
        const standardColumns = buildStandardColumns(params);
        const sheets = {};
        sheets['Total'] = await buildRepTotalSheet(repPace, standardColumns);
        sheets['Assigned Reps'] = await buildSubRepSheet(repPace, standardColumns);
        sheets['Assigned Customers'] = await buildCustomerSheet(repPace, standardColumns);
        const workBook = await buildWorkBook(sheets);
        const filename = `Rep_Pace_${req.params.SalespersonDivisionNo}-${req.params.SalespersonNo}_${dayjs(req.params.maxDate).format('YYYY-MM-DD')}.xlsx`;
        const headers = buildXLSXHeaders(filename);
        Object.keys(headers).forEach(key => {
            res.setHeader(key, headers[key]);
        });
        res.send(workBook);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepPaceXLSX()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getRepPaceXLSX' });
    }
}
