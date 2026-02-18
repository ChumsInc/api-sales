import { buildWorkBook, buildXLSXHeaders, mysql2Pool, resultToExcelSheet, } from 'chums-local-modules';
import Debug from "debug";
import numeral from 'numeral';
import { parse, titles } from './params.js';
import { billToQuery } from './queries.js';
import dayjs from 'dayjs';
import { Decimal } from "decimal.js";
const debug = Debug('chums:lib:sales:account-list:bill-to');
export async function loadAccounts({ filters, periods, sqlSort }) {
    try {
        const top = +(filters.top ?? 10000);
        const [SalespersonDivisionNo = filters.SalespersonNo || '\\B', SalespersonNo = filters.SalespersonNo || '\\B'] = (filters.SalespersonNo || '').split('-');
        const sql = `${billToQuery}
        ORDER BY ${sqlSort}
        LIMIT ${top}`;
        const [rows] = await mysql2Pool.query(sql, {
            ...filters, ...periods, SalespersonDivisionNo, SalespersonNo
        });
        const totals = {
            SalesP1: 0,
            SalesP2: 0,
            SalesP3: 0,
            SalesP4: 0,
            SalesP5: 0,
        };
        const accounts = rows.map(row => {
            totals.SalesP1 = new Decimal(totals.SalesP1).add(row.SalesP1 ?? 0).toString();
            totals.SalesP2 = new Decimal(totals.SalesP2).add(row.SalesP2 ?? 0).toString();
            totals.SalesP3 = new Decimal(totals.SalesP3).add(row.SalesP3 ?? 0).toString();
            totals.SalesP4 = new Decimal(totals.SalesP4).add(row.SalesP4 ?? 0).toString();
            totals.SalesP5 = new Decimal(totals.SalesP5).add(row.SalesP5 ?? 0).toString();
            return {
                ...row,
            };
        });
        return {
            rows: accounts,
            totals,
            query: mysql2Pool.format(sql, { ...filters, ...periods, SalespersonDivisionNo, SalespersonNo }),
            params: { ...filters, ...periods, SalespersonDivisionNo, SalespersonNo },
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadAccounts()", err.message);
            return Promise.reject(err);
        }
        debug("loadAccounts()", err);
        return Promise.reject(new Error('Error in loadAccounts()'));
    }
}
function prepForRender(rows) {
    return rows.map(row => {
        return {
            ...row,
            DateCreated: row.DateCreated ? dayjs(row.DateCreated).format('MM-DD-YYYY') : null,
            DateLastActivity: row.DateLastActivity ? dayjs(row.DateLastActivity).format('MM-DD-YYYY') : null,
            SalesP1: numeral(row.SalesP1).format('0,0.00'),
            SalesP2: numeral(row.SalesP2).format('0,0.00'),
            SalesP3: numeral(row.SalesP3).format('0,0.00'),
            SalesP4: numeral(row.SalesP4).format('0,0.00'),
            SalesP5: numeral(row.SalesP5).format('0,0.00'),
        };
    });
}
export const getAccountList = async (req, res) => {
    try {
        const _params = await parse({ ...req.body, ...req.query }, res.locals.profile.user.id);
        const { rows, query, params } = await loadAccounts(_params);
        res.json({ params, query, rows });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getAccountList()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getAccountList' });
    }
};
export const renderAccountList = async (req, res) => {
    try {
        const { sqlSort, fields, filters, periods } = await parse(req.body, res.locals.profile.user.id);
        const { rows, query, totals } = await loadAccounts({ filters, periods, sqlSort });
        debug('render()', rows.length);
        res.render('sales/account-list', { rows: prepForRender(rows), fields, titles, periods, query, totals });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderAccountList()", err.message);
            res.status(500).send(`<div class="alert alert-danger"><strong>Error:</strong> ${err.message}</div>`);
            return;
        }
        res.status(500).send(`<div class="alert alert-danger"><strong>Error:</strong> An unknown error occurred.</div>`);
    }
};
export const renderAccountListXLSX = async (req, res) => {
    try {
        const { sqlSort, fields, filters, periods } = await parse(req.body, res.locals.profile.user.id);
        const { rows } = await loadAccounts({ filters, periods, sqlSort });
        const columnNames = {};
        ['account', ...fields].forEach(field => {
            if (['SalesP1', 'SalesP2', 'SalesP3', 'SalesP4', 'SalesP5'].includes(field)) {
                columnNames[field] = titles.periodTitles[field](periods);
            }
            else {
                columnNames[field] = titles.dataTitles[field]();
            }
        });
        const sheet = resultToExcelSheet(rows, columnNames, true);
        const sheets = { 'Account List': sheet };
        const workbook = await buildWorkBook(sheets, {
            bookType: 'xlsx',
            bookSST: true,
            type: 'buffer',
            compression: true
        });
        const filename = new Date().toISOString();
        res.setHeaders(buildXLSXHeaders(filename));
        res.send(workbook);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderAccountListXLSX()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in renderAccountListXLSX' });
    }
};
