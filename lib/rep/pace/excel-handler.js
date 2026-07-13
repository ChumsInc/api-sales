import Debug from "debug";
import { buildWorkBook, buildXLSXHeaders, resultToExcelSheet } from 'chums-local-modules';
import { addTotals, injectPace, parseRepSlug, rollupRepPace, zeroRepTotals } from './utils.js';
import dayjs from "dayjs";
import { loadRepPaceV3 } from "./rep-data.js";
import { loadManagedCustomers } from "./rep-customers.js";
import { Decimal } from "decimal.js";
const debug = Debug('chums:lib:sales:rep:rep-pace');
const REGEX_TITLES = /^[A-Z]+1$/i;
const REGEX_DOLLARS = /^[DEFGHIJL]/i;
const REGEX_PCT = /^[K][0-9]+/i;
function buildStandardColumns({ minDate, maxDate }) {
    const _fromDate = dayjs(minDate);
    const _toDate = dayjs(maxDate);
    return {
        OpenTotal: 'Open',
        InvCYTD: `${_fromDate.format('MM/DD')}-${_toDate.format('MM/DD/YYYY')}`,
        InvCY: `${_toDate.format('YYYY')} Total`,
        InvPYTD: `${_fromDate.subtract(1, 'years').format('MM/DD')}-${_toDate.subtract(1, 'years').format('MM/DD/YYYY')}`,
        InvPY: `${_toDate.subtract(1, 'years').format('YYYY')} Total`,
        InvP2TD: `${_fromDate.subtract(2, 'years').format('MM/DD')}-${_toDate.subtract(2, 'years').format('MM/DD/YYYY')}`,
        InvP2: `${_toDate.subtract(2, 'years').format('YYYY')} Total`,
        rate: 'Growth',
        pace: 'Pace',
    };
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
function toRepExcelFields(arg) {
    const total = injectPace({
        OpenTotal: arg.OpenTotal ?? '0',
        InvCYTD: arg.InvCYTD ?? '0',
        InvCY: arg.InvCY ?? '0',
        InvPYTD: arg.InvPYTD ?? '0',
        InvPY: arg.InvPY ?? '0',
        InvP2TD: arg.InvP2TD ?? '0',
        InvP2: arg.InvP2 ?? '0',
    });
    return {
        OpenTotal: new Decimal(total.OpenTotal ?? 0).toNumber(),
        InvCYTD: new Decimal(total.InvCYTD ?? 0).toNumber(),
        InvCY: new Decimal(total.InvCY ?? 0).toNumber(),
        InvPYTD: new Decimal(total.InvPYTD ?? 0).toNumber(),
        InvPY: new Decimal(total.InvPY ?? 0).toNumber(),
        InvP2TD: new Decimal(total.InvP2TD ?? 0).toNumber(),
        InvP2: new Decimal(total.InvP2 ?? 0).toNumber(),
        rate: new Decimal(total.rate ?? 0).toNumber(),
        pace: new Decimal(total.pace ?? 0).toNumber(),
    };
}
async function buildRepTotalSheet(reps, customers, standardColumns) {
    const data = [];
    if (reps.length === 1) {
        const { totals, subRepTotals } = reps[0];
        data.push({
            account: 'ALL',
            name: 'AssignedReps',
            email: '',
            ...toRepExcelFields(addTotals(totals, subRepTotals ?? zeroRepTotals))
        });
    }
    else {
        const total = reps.map(row => addTotals(row.totals, row.subRepTotals ?? zeroRepTotals))
            .reduce((pv, cv) => addTotals(pv, cv), zeroRepTotals);
        data.push({
            account: 'ALL',
            name: 'AssignedReps',
            email: '',
            ...toRepExcelFields(total)
        });
    }
    data.push({
        account: 'ALL',
        name: 'Assigned Customers',
        email: '',
        ...toRepExcelFields(customers
            .map(row => ({ ...row.totals, count: 0 }))
            .reduce((pv, cv) => addTotals(cv, pv), zeroRepTotals))
    });
    const columnNames = {
        account: 'Account',
        name: 'Group',
        email: '--',
        ...standardColumns
    };
    const workSheet = resultToExcelSheet(data, columnNames, true);
    return formatWorkSheet(workSheet);
}
async function buildSubRepSheet(reps, standardColumns) {
    const data = [];
    if (reps.length === 1) {
        if (reps[0].subReps) {
            data.push(...Object.values(reps[0].subReps).map(rep => ({
                Salesperson: rep.SalespersonCode,
                SalespersonName: rep.SalespersonName,
                EmailAddress: '',
                ...toRepExcelFields(addTotals(rep.totals, rep.subRepTotals ?? zeroRepTotals))
            })));
            data.push({
                Salesperson: 'TOTAL',
                SalespersonName: '---',
                EmailAddress: '',
                ...toRepExcelFields(addTotals(reps[0].totals, reps[0].subRepTotals ?? zeroRepTotals))
            });
        }
    }
    else {
        data.push(...reps.map(rep => ({
            Salesperson: rep.SalespersonCode,
            SalespersonName: rep.SalespersonName,
            EmailAddress: '',
            ...toRepExcelFields(addTotals(rep.totals, rep.subRepTotals ?? zeroRepTotals))
        })));
        const total = reps
            .map(rep => addTotals(rep.totals, rep.subRepTotals ?? zeroRepTotals))
            .reduce((pv, cv) => addTotals(pv, cv), zeroRepTotals);
        data.push({
            Salesperson: 'TOTAL',
            SalespersonName: '---',
            EmailAddress: '',
            ...toRepExcelFields(total)
        });
    }
    const columnNames = {
        Salesperson: 'Rep Acct',
        SalespersonName: 'Rep Name',
        EmailAddress: 'Email',
        ...standardColumns
    };
    const workSheet = resultToExcelSheet(data, columnNames, true);
    return formatWorkSheet(workSheet);
}
async function buildCustomerSheet(customers, standardColumns) {
    const data = customers.map(row => ({
        account: row.CustomerCode,
        name: row.CustomerName,
        email: row.EmailAddress,
        ...toRepExcelFields({ ...row.totals, count: 0 })
    }));
    const customerTotal = customers.map(row => ({ ...row.totals, count: 0 }))
        .reduce((pv, cv) => addTotals(cv, pv), zeroRepTotals);
    data.push({
        account: 'TOTAL',
        name: '---',
        email: null,
        ...toRepExcelFields(customerTotal),
    });
    const columnNames = {
        account: 'Customer Acct',
        name: 'Customer Name',
        email: 'EMail',
        ...standardColumns
    };
    const workSheet = resultToExcelSheet(data, columnNames, true);
    return formatWorkSheet(workSheet);
}
export async function getRepPaceXLSXV3(req, res) {
    try {
        const { salespersonDivisionNo, salespersonNo } = parseRepSlug(req.query.rep);
        const params = {
            SalespersonDivisionNo: salespersonDivisionNo,
            SalespersonNo: salespersonNo,
            minDate: req.query.minDate,
            maxDate: req.query.maxDate,
            userid: res.locals.profile.user.id,
        };
        const repData = await loadRepPaceV3(params);
        if (!repData) {
            res.json({ repPace: 'no data returned' });
            return;
        }
        const repRollup = rollupRepPace(repData);
        const customers = await loadManagedCustomers(params);
        const standardColumns = buildStandardColumns(params);
        const sheets = {};
        sheets['Total'] = await buildRepTotalSheet(repRollup, customers, standardColumns);
        sheets['Assigned Reps'] = await buildSubRepSheet(repRollup, standardColumns);
        sheets['Assigned Customers'] = await buildCustomerSheet(customers, standardColumns);
        const workBook = await buildWorkBook(sheets);
        const filename = `Rep_Pace_${params.SalespersonDivisionNo ?? 'All'}-${params.SalespersonNo ?? 'Reps'}_${dayjs(params.maxDate).format('YYYY-MM-DD')}.xlsx`;
        res.setHeaders(buildXLSXHeaders(filename));
        res.send(workBook);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepPaceXLSX()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getRepPaceXLSX' });
    }
}
