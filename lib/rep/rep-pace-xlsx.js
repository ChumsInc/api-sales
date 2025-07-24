import Debug from "debug";
import {buildWorkBook, buildXLSXHeaders, resultToExcelSheet} from 'chums-local-modules';
import {loadRepPace, REP_TOTAL} from './rep-pace.js';
import Decimal from "decimal.js";
import dayjs from "dayjs";

const debug = Debug('chums:lib:sales:rep:rep-pace');

const REGEX_TITLES = /^[A-Z]+1$/i;
const REGEX_DOLLARS = /^[DEFGHIK]/i;
const REGEX_PCT = /^[J][0-9]+/i;

function parseRep(rep) {
    const {SalespersonDivisionNo, SalespersonNo, SalespersonName} = rep;
    return {
        Salesperson: `${SalespersonDivisionNo}-${SalespersonNo}`,
        SalespersonName,
        ...rep.total,
        OpenOrders: new Decimal(rep.total.OpenOrders).toNumber(),
        InvCYTD: new Decimal(rep.total.InvCYTD).toNumber(),
        InvPYTD: new Decimal(rep.total.InvPYTD).toNumber(),
        InvPY: new Decimal(rep.total.InvPY).toNumber(),
        InvP2TD: new Decimal(rep.total.InvP2TD).toNumber(),
        InvP2: new Decimal(rep.total.InvP2).toNumber(),
        rate: new Decimal(rep.total.rate).toNumber(),
        pace: new Decimal(rep.total.pace).toNumber(),
    }
}

function buildStandardColumns({minDate, maxDate}) {
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
    const acc = {...accumulator};
    acc.OpenOrders = new Decimal(acc.OpenOrders).add(currentValue.OpenOrders ?? 0).toNumber();
    acc.InvCYTD = new Decimal(acc.InvCYTD).add(currentValue.InvCYTD ?? 0).toNumber();
    acc.InvPYTD = new Decimal(acc.InvPYTD).add(currentValue.InvPYTD ?? 0).toNumber();
    acc.InvPY = new Decimal(acc.InvPY).add(currentValue.InvPY ?? 0).toNumber();
    acc.InvP2TD = new Decimal(acc.InvP2TD).add(currentValue.InvP2TD ?? 0).toNumber();
    acc.InvP2 = new Decimal(acc.InvP2).add(currentValue.InvP2 ?? 0).toNumber();
    acc.rate = new Decimal(acc.InvPYTD).eq(0)
        ? (new Decimal(acc.InvCYTD).eq(0) ? 0 : 1)
        : new Decimal(acc.InvCYTD).sub(acc.InvPYTD).div(acc.InvPYTD).toDecimalPlaces(4).toNumber();
    acc.pace = new Decimal(acc.InvPY).eq(0)
        ? new Decimal(acc.InvCYTD).add(acc.OpenOrders).toNumber()
        : new Decimal(acc.rate).add(1).times(acc.InvPY).toDecimalPlaces(4).toNumber();
    return acc;
}

function repSubRepsTotal(subReps = []) {
    return subReps
        .filter(row => !!row.rep.Active || !!row.rep.total.pace)
        .map(row => parseRep(row.rep))
        .reduce(repReducer, REP_TOTAL);
}

function repCustomersTotal(repCustomers = []) {
    return repCustomers.reduce(repReducer, REP_TOTAL);
}

function formatWorkSheet(workSheet) {
    Object.keys(workSheet)
        .filter(key => REGEX_TITLES.test(key) === false)
        .filter(key => REGEX_DOLLARS.test(key))
        .forEach(key => {
            workSheet[key].z = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
        });
    Object.keys(workSheet)
        .filter(key => REGEX_TITLES.test(key) === false)
        .filter(key => REGEX_PCT.test(key))
        .forEach(key => {
            workSheet[key].z = '0%';
        })
    return workSheet;
}

async function buildRepTotalSheet({rep, repSubReps, repCustomers, standardColumns}) {
    const {Salesperson, SalespersonName, ...repTotal} = parseRep(rep);
    const subRepTotal = repSubRepsTotal(repSubReps);
    const customerTotal = repCustomersTotal(repCustomers);

    const data = [
        {account: 'ALL', name: 'Assigned Reps', email: '', ...subRepTotal},
        {account: 'ALL', name: 'Assigned Customers', email: '', ...customerTotal},
        {account: 'ALL', name: 'Total', email: '', ...repTotal},
    ];

    const workSheet = await resultToExcelSheet(data,
        {account: 'Account', name: 'Group', email: '--', ...standardColumns},
        true);

    return formatWorkSheet(workSheet);
}

async function buildSubRepSheet({repSubReps, standardColumns}) {
    const subRepTotal = repSubRepsTotal(repSubReps);
    const subRepRows = repSubReps
        .filter(row => !!row.rep.Active || !!row.rep.total.pace)
        .map(row => parseRep(row.rep));

    const data = [
        ...subRepRows,
        {Salesperson: 'TOTAL', SalespersonName: '---', EmailAddress: '', ...subRepTotal},
    ];

    const workSheet = await resultToExcelSheet(data,
        {Salesperson: 'Rep Acct', SalespersonName: 'Rep Name', EmailAddress: 'Email', ...standardColumns},
        true);

    return formatWorkSheet(workSheet);
}

async function buildCustomerSheet({repCustomers, standardColumns}) {
    const customerTotal = repCustomersTotal(repCustomers);
    const customers = repCustomers.map(customer => {
        const {ARDivisionNo, CustomerNo, CustomerName, EmailAddress, ...rest} = customer;
        return {
            account: `${ARDivisionNo}-${CustomerNo}`,
            name: CustomerName,
            email: EmailAddress ?? '',
            OpenOrders: new Decimal(rest.OpenOrders).toNumber(),
            InvCYTD: new Decimal(rest.InvCYTD).toNumber(),
            InvPYTD: new Decimal(rest.InvPYTD).toNumber(),
            InvPY: new Decimal(rest.InvPY).toNumber(),
            InvP2TD: new Decimal(rest.InvP2TD).toNumber(),
            InvP2: new Decimal(rest.InvP2).toNumber(),
            rate: new Decimal(rest.rate).toNumber(),
            pace: new Decimal(rest.pace).toNumber(),
        };
    })

    const data = [
        ...customers,
        {account: 'TOTAL', name: '---', ...customerTotal},
    ];

    const workSheet = await resultToExcelSheet(data,
        {account: 'Customer Acct', name: 'Customer Name', email: 'EMail', ...standardColumns}
        , true);

    return formatWorkSheet(workSheet);
}

export async function getRepPaceXLSX(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const repPace = await loadRepPace({...req.query, ...req.params, groupByCustomer: true, userid});
        const standardColumns = buildStandardColumns(req.params);
        const sheets = {};
        sheets['Total'] = await buildRepTotalSheet({...repPace, standardColumns});
        sheets['Assigned Reps'] = await buildSubRepSheet({...repPace, standardColumns});
        sheets['Assigned Customers'] = await buildCustomerSheet({...repPace, standardColumns});

        const workBook = await buildWorkBook(sheets);
        const filename = `Rep_Pace_${req.params.SalespersonDivisionNo}-${req.params.SalespersonNo}_${dayjs(req.params.maxDate).format('YYYY-MM-DD')}.xlsx`;
        const headers = buildXLSXHeaders(filename);
        Object.keys(headers).forEach(key => {
            res.setHeader(key, headers[key]);
        })
        res.send(workBook);
    } catch (err) {
        debug("getRepPaceXLSX()", err.message);
        res.json({error: err.message})
    }
}

export async function getRepPaceXLSX_v2(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const minDate = !!req.query.minDate && dayjs(req.query.minDate).isValid()
            ? req.query.minDate
            : dayjs().startOf('year').format('YYYY-MM-DD');

        const maxDate = !!req.query.maxDate && dayjs(req.query.maxDate).isValid()
            ? req.query.maxDate
            : dayjs().format('YYYY-MM-DD');

        const [salespersonDivisionNo, salespersonNo] = /0[1-9]-\S{4}/.test(req.query.rep ?? '') ? req.query.rep.split('-') : [undefined, undefined];

        const params = {
            Company: 'chums',
            SalespersonDivisionNo: salespersonDivisionNo,
            SalespersonNo: salespersonNo,
            minDate,
            maxDate,
            userid,
            groupByCustomer: true,
        }
        const repPace = await loadRepPace(params);
        const standardColumns = buildStandardColumns(req.params);
        const sheets = {};
        sheets['Total'] = await buildRepTotalSheet({...repPace, standardColumns});
        sheets['Assigned Reps'] = await buildSubRepSheet({...repPace, standardColumns});
        sheets['Assigned Customers'] = await buildCustomerSheet({...repPace, standardColumns});

        const workBook = await buildWorkBook(sheets);
        const repTitle = `${repPace?.rep?.SalespersonDivisionNo ?? ''}-${repPace?.rep?.SalespersonNo ?? ''}`;
        const filename = `Rep_Pace_${repTitle}_${dayjs(maxDate).format('YYYY-MM-DD')}.xlsx`;
        const headers = buildXLSXHeaders(filename);
        Object.keys(headers).forEach(key => {
            res.setHeader(key, headers[key]);
        })
        res.send(workBook);
    } catch (err) {
        debug("getRepPaceXLSX()", err.message, err);
        res.json({error: err.message})
    }
}

