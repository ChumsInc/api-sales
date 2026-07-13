import Debug from "debug";
import { Decimal } from "decimal.js";
const debug = Debug('chums:lib:rep:pace:utils');
export function calcGrowthRate(current, prev) {
    if (new Decimal(prev).eq(0)) {
        return new Decimal(new Decimal(current).lte(0) ? 0 : 1);
    }
    return new Decimal(current).sub(prev).div(new Decimal(prev).abs());
}
export function calcPace(prev, rate) {
    return new Decimal(rate).add(1).times(prev);
}
export function salespersonKey(row) {
    return `${row.SalespersonDivisionNo}-${row.SalespersonNo}`;
}
export function salesManagerKey(row) {
    if (!row.SalesManagerDivisionNo || !row.SalesManagerNo) {
        return null;
    }
    return `${row.SalesManagerDivisionNo ?? ''}-${row.SalesManagerNo ?? ''}`;
}
export function injectPace(arg) {
    const rate = calcGrowthRate(arg.InvCYTD ?? 0, arg.InvPYTD ?? 0);
    const pace = new Decimal(arg.InvPY ?? 0).eq(0)
        ? new Decimal(arg.InvCYTD ?? 0).add(arg.OpenTotal ?? 0)
        : calcPace(arg.InvPY, rate);
    return {
        ...arg,
        rate: rate.toDecimalPlaces(4).toString(),
        pace: pace.toDecimalPlaces(4).toString(),
    };
}
export function customerTotals(row) {
    return injectPace({
        OpenTotal: new Decimal(row.OpenTotal ?? 0).toString(),
        InvCYTD: new Decimal(row.InvCYTD ?? 0).toString(),
        InvCY: new Decimal(row.InvCY ?? 0).toString(),
        InvPYTD: new Decimal(row.InvPYTD ?? 0).toString(),
        InvPY: new Decimal(row.InvPY ?? 0).toString(),
        InvP2TD: new Decimal(row.InvP2TD ?? 0).toString(),
        InvP2: new Decimal(row.InvP2 ?? 0).toString(),
    });
}
export function addTotals(totals, row) {
    if (!totals) {
        return injectPace({
            OpenTotal: new Decimal(row.OpenTotal ?? 0).toString(),
            InvCYTD: new Decimal(row.InvCYTD ?? 0).toString(),
            InvCY: new Decimal(row.InvCY ?? 0).toString(),
            InvPYTD: new Decimal(row.InvPYTD ?? 0).toString(),
            InvPY: new Decimal(row.InvPY ?? 0).toString(),
            InvP2TD: new Decimal(row.InvP2TD ?? 0).toString(),
            InvP2: new Decimal(row.InvP2 ?? 0).toString(),
            count: row.count ?? 0,
        });
    }
    return injectPace({
        OpenTotal: new Decimal(totals.OpenTotal ?? 0).add(row.OpenTotal ?? 0).toString(),
        InvCYTD: new Decimal(totals.InvCYTD ?? 0).add(row.InvCYTD ?? 0).toString(),
        InvCY: new Decimal(totals.InvCY ?? 0).add(row.InvCY ?? 0).toString(),
        InvPYTD: new Decimal(totals.InvPYTD ?? 0).add(row.InvPYTD ?? 0).toString(),
        InvPY: new Decimal(totals.InvPY ?? 0).add(row.InvPY ?? 0).toString(),
        InvP2TD: new Decimal(totals.InvP2TD ?? 0).add(row.InvP2TD ?? 0).toString(),
        InvP2: new Decimal(totals.InvP2 ?? 0).add(row.InvP2 ?? 0).toString(),
        count: new Decimal(totals.count ?? 0).add(row.count ?? 0).toNumber(),
    });
}
function rollupTotals(data) {
    if (!data.subReps) {
        return {
            ...data,
            subRepTotals: null,
        };
    }
    const totals = [];
    Object.values(data.subReps).forEach(subRep => {
        const rollup = rollupTotals(subRep);
        data.subReps[rollup.SalespersonCode] = rollup;
        totals.push(addTotals(rollup.subRepTotals, rollup.totals));
    });
    const reducedTotals = totals.reduce((pv, cv) => {
        return addTotals(pv, cv);
    }, null);
    return {
        ...data,
        subRepTotals: reducedTotals
    };
}
export function rollupRepPace(rows) {
    const data = {};
    rows.forEach(row => {
        const key = row.SalespersonCode;
        if (!data[key]) {
            data[key] = {
                ...row,
                subReps: null,
                subRepTotals: null,
            };
        }
    });
    rows.sort((a, b) => b.Level - a.Level)
        .forEach(row => {
        const parentKey = row.SalesManagerCode;
        const repKey = row.SalespersonCode;
        if (parentKey && parentKey in data) {
            if (!data[parentKey].subReps) {
                data[parentKey].subReps = {};
            }
            data[parentKey].subReps[repKey] = data[repKey];
        }
    });
    return Object.values(data).filter(row => row.Level === 0).map(row => rollupTotals(row));
}
export function parseRepSlug(arg) {
    const [salespersonDivisionNo, salespersonNo] = /[01][0-9]-\w+/.test(arg) ? arg.split('-') : [undefined, undefined];
    return {
        salespersonDivisionNo,
        salespersonNo
    };
}
export const zeroRepTotals = {
    OpenTotal: '0',
    InvCYTD: '0',
    InvCY: '0',
    InvPYTD: '0',
    InvPY: '0',
    InvP2TD: '0',
    InvP2: '0',
    rate: '0',
    pace: '0',
    count: '0'
};
