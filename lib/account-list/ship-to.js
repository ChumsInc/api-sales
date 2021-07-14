const {mysql2Pool, buildWorkBook, resultToExcelSheet} = require('chums-local-modules');
const debug = require('debug')('chums:lib:sales:account-list:bill-to');
const {parseISO, format} = require('date-fns');
const numeral = require('numeral');
const {parse, sortFields, fields, titles} = require('./params');
const {shipToQuery} = require('./queries');

const loadAccounts = async ({filters, periods, sqlSort}) => {
    try {

    } catch (err) {
        debug("loadAccounts()", err.message);
        return Promise.reject(err);
    }
    try {
        const query = `${shipToQuery}
            ORDER BY ${sqlSort}
            LIMIT ${filters.top || 1000}
            `;
        const [
            SalespersonDivisionNo = filters.SalespersonNo || '\\B',
            SalespersonNo = filters.SalespersonNo || '\\B'
        ] = (filters.SalespersonNo || '').split('-');
        // debug('loadAccounts()', {...filters, ...periods, SalespersonDivisionNo, SalespersonNo});
        const [rows] = await mysql2Pool.query(query, {...filters, ...periods, SalespersonDivisionNo, SalespersonNo});
        rows.map(row => {
            row.SalesP1 = Number(row.SalesP1);
            row.SalesP2 = Number(row.SalesP2);
            row.SalesP3 = Number(row.SalesP3);
            row.SalesP4 = Number(row.SalesP4);
            row.SalesP5 = Number(row.SalesP5);
            row.CustomerAddress = [row.AddressLine1 || '', row.AddressLine2 || '', row.AddressLine3 || ''].filter(row => !!row.trim()).join('; ');
        });
        return {
            rows,
            query: mysql2Pool.format(query, {...filters, ...periods, SalespersonDivisionNo, SalespersonNo}),
            params: {...filters, ...periods, SalespersonDivisionNo, SalespersonNo},
        };
    } catch (err) {
        debug("loadAccounts", err.message);
        return Promise.reject(err);
    }
};

const prepForRender = (rows) => {
    return rows.map(row => {
        try {
            return {
                ...row,
                ...{
                    DateCreated: !!row.DateCreated ? format(row.DateCreated, 'MM-dd-yyyy') : null,
                    DateLastActivity: !!row.DateLastActivity ? format(row.DateLastActivity, 'MM-dd-yyyy') : null,
                    SalesP1: numeral(row.SalesP1).format('0,0.00'),
                    SalesP2: numeral(row.SalesP2).format('0,0.00'),
                    SalesP3: numeral(row.SalesP3).format('0,0.00'),
                    SalesP4: numeral(row.SalesP4).format('0,0.00'),
                    SalesP5: numeral(row.SalesP5).format('0,0.00'),
                }
            };
        } catch (err) {
            debug("prepForRender()", err.message, row);
            return Promise.reject(err);
        }
    });
};

exports.get = async (req, res) => {
    try {
        const _params = await parse({...req.body, ...req.query}, res.locals.profile.user);
        const {rows, params, query} = await loadAccounts(_params);
        return res.json({params, query, rows});
    } catch (err) {
        debug("get()", err.message);
        return res.json(err);
    }

};

exports.render = async (req, res) => {
    try {
        const {sqlSort, fields, filters, periods} = await parse(req.body, res.locals.profile.user);
        const {rows, query} = await loadAccounts({filters, periods, sqlSort});
        debug('render()', rows.length);
        res.render('sales/account-list', {rows: prepForRender(rows), fields, titles, periods, query});
    } catch (err) {
        debug("render()", err.message);
        res.send(`<div class="alert alert-danger"><strong>Error:</strong> ${err.message}</div>`);
    }
}

exports.xlsx = async (req, res) => {
    try {
        const {sqlSort, fields, filters, periods} = await parse(req.body, res.locals.profile.user);
        const {rows} = await loadAccounts({filters, periods, sqlSort});
        const columnNames = {};
        ['account', ...fields].forEach(field => {
            columnNames[field] = titles[field](periods);
        });
        const sheet = resultToExcelSheet(rows, columnNames, true);
        const sheets = {'Account List': sheet};
        const workbook = await buildWorkBook(sheets, {
            bookType: 'xlsx',
            bookSST: true,
            type: 'buffer',
            compression: true
        });
        const filename = new Date().toISOString();
        res.setHeader('Content-disposition', `attachment; filename=AccountList-${filename}.xlsx`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(workbook);
    } catch (err) {
        debug("xlsx()", err.message);
        res.jsonp({error: err.message});
    }
};
