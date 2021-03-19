const {mysql2Pool, buildWorkbook, resultToExcelSheet} = require('chums-local-modules');
const debug = require('debug')('chums:lib:sales:account-list:bill-to');
const {parseISO, format} = require('date-fns');
const numeral = require('numeral');
const {parse, sortFields, fields, titles} = require('./params');

const loadAccounts = async ({filters, periods, sqlSort}) => {
    try {

    } catch (err) {
        debug("loadAccounts()", err.message);
        return Promise.reject(err);
    }
    try {
        let query = `
            SELECT c.ARDivisionNo,
                   c.CustomerNo,
                   ''                                                    AS ShipToCode,
                   CONCAT(c.ARDivisionNo, '-', c.CustomerNo)             AS account,
                   IFNULL(b2b.isb2b, '-')                                AS isb2b,
                   c.CustomerName,
                   c.AddressLine1,
                   c.AddressLine2,
                   c.AddressLine3,
                   c.City,
                   c.State,
                   c.ZipCode,
                   c.CountryCode,
                   c.TelephoneNo,
                   c.FaxNo,
                   c.EmailAddress,
#                    c.SalespersonDivisionNo,
#                    c.SalespersonNo,
                   CONCAT(c.SalespersonDivisionNo, '-', c.SalespersonNo) AS SalespersonNo,
                   r.SalespersonName,
                   c.DateCreated,
                   c.CustomerType,
                   c.PriceLevel,
                   c.DateLastActivity,
                   IF(IFNULL(:SalesP1, 0) = 0,
                      0,
                      IFNULL((
                             SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                             FROM c2.ar_invoicehistoryheader h
                             WHERE h.Company = c.Company
                               AND h.ARDivisionNo = c.ardivisionno
                               AND h.CustomerNo = c.customerno
                               AND a.primaryAccount = 1
                               AND h.InvoiceDate BETWEEN :p1MinDate AND :p1MaxDate), 0)
                       )                                                 AS SalesP1,
                   IF(IFNULL(:SalesP2, 0) = 0,
                      0,
                      IFNULL((
                             SELECT ROUND(SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt), 2)
                             FROM c2.ar_invoicehistoryheader h
                             WHERE h.Company = c.Company
                               AND h.ARDivisionNo = c.ardivisionno
                               AND h.CustomerNo = c.customerno
                               AND a.primaryAccount = 1
                               AND h.InvoiceDate BETWEEN :p2MinDate AND :p2MaxDate), 0)
                       )                                                 AS SalesP2,
                   IF(IFNULL(:SalesP3, 0) = 0,
                      0,
                      IFNULL((
                             SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                             FROM c2.ar_invoicehistoryheader h
                             WHERE h.Company = c.Company
                               AND h.ARDivisionNo = c.ardivisionno
                               AND h.CustomerNo = c.customerno
                               AND a.primaryAccount = 1
                               AND h.InvoiceDate BETWEEN :p3MinDate AND :p3MaxDate), 0)
                       )                                                 AS SalesP3,
                   IF(IFNULL(:SalesP4, 0) = 0,
                      0,
                      IFNULL((
                             SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                             FROM c2.ar_invoicehistoryheader h
                             WHERE h.Company = c.Company
                               AND h.ARDivisionNo = c.ardivisionno
                               AND h.CustomerNo = c.customerno
                               AND a.primaryAccount = 1
                               AND h.InvoiceDate BETWEEN :p4MinDate AND :p4MaxDate), 0)
                       )                                                 AS SalesP4,
                   IF(IFNULL(:SalesP5, 0) = 0,
                      0,
                      IFNULL((
                             SELECT ROUND(SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt), 2)
                             FROM c2.ar_invoicehistoryheader h
                             WHERE h.Company = c.Company
                               AND h.ARDivisionNo = c.ardivisionno
                               AND h.CustomerNo = c.customerno
                               AND a.primaryAccount = 1
                               AND h.InvoiceDate BETWEEN :p5MinDate AND :p5MaxDate), 0)
                       )                                                 AS SalesP5
            FROM c2.ar_customer c
                 INNER JOIN users.accounts a
                            ON userid = :userId AND c.Company LIKE a.Company
                                AND c.ardivisionno LIKE a.ARDivisionNo
                                AND ((c.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                     (c.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                                AND a.primaryAccount = 1
                 LEFT JOIN  c2.ar_salesperson r
                            ON r.Company = c.Company
                                AND r.SalespersonDivisionNo = c.SalespersonDivisionNo
                                AND r.SalespersonNo = c.SalespersonNo
                 LEFT JOIN  (
                            SELECT DISTINCT c.company, c.ARDivisionNo, c.CustomerNo, 'YES' AS isb2b
                            FROM users.users u
                                 INNER JOIN users.accounts a
                                            ON a.userid = u.id
                                 INNER JOIN c2.ar_customer c
                                            ON c.Company = a.Company AND c.ARDivisionNo = a.ARDivisionNo AND
                                               c.CustomerNo = a.CustomerNo
                            WHERE u.accountType = 4
                              AND u.active = 1
                            ) b2b
                            ON b2b.Company = c.company AND b2b.ARDivisionNo = c.ARdivisionno AND
                               b2b.CustomerNo = c.CustomerNo
            WHERE c.Company = :company
              AND (IFNULL(:ARDivisionNo, '') = '' OR c.ARDivisionNo REGEXP :ARDivisionNo)
              AND (IFNULL(:CustomerNo, '') = '' OR CONCAT_WS('-', c.ARDivisionNo, c.CustomerNo) REGEXP :CustomerNo)
              AND (c.salespersonno LIKE :SalespersonNo
                OR r.SalesmanagerNo LIKE :SalespersonNo
                OR (c.SalespersonDivisionNo REGEXP :SalespersonDivisionNo AND c.SalespersonNo REGEXP :SalespersonNo)
                )
              AND (IFNULL(:State, '') = '' OR c.state LIKE :State)
              AND (IFNULL(:CountryCode, '') = '' OR c.countrycode LIKE :CountryCode)
              AND (IFNULL(:CustomerType, '') = '' OR c.CustomerType LIKE :CustomerType)
              AND c.CustomerStatus = 'A'
              AND (
                    (ISNULL(:DateCreatedMin) AND ISNULL(:DateCreatedMax))
                    OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = FALSE AND
                        DateCreated BETWEEN :DateCreatedMin AND :DateCreatedMax)
                    OR (ISNULL(:DateCreatedMin) = FALSE AND ISNULL(:DateCreatedMax) = TRUE AND
                        DateCreated >= :DateCreatedMin)
                    OR (ISNULL(:DateCreatedMin) = TRUE AND ISNULL(:DateCreatedMax) = FALSE AND
                        DateCreated <= :DateCreatedMax)
                )
              AND (
                    (ISNULL(:DateLastActivityMin) AND ISNULL(:DateLastActivityMax))
                    OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = FALSE AND
                        DateLastActivity BETWEEN :DateLastActivityMin AND :DateLastActivityMax)
                    OR (ISNULL(:DateLastActivityMin) = FALSE AND ISNULL(:DateLastActivityMax) = TRUE AND
                        DateLastActivity >= :DateLastActivityMin)
                    OR (ISNULL(:DateLastActivityMin) = TRUE AND ISNULL(:DateLastActivityMax) = FALSE AND
                        DateLastActivity <= :DateLastActivityMax)
                )
        `;
        query += `
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
            row.CustomerAddress = [row.AddressLine1, row.AddressLine2, row.AddressLine3].filter(row => !!row.trim()).join('; ');
        });
        return rows;
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
        const params = await parse({...req.body, ...req.query}, res.locals.profile.user);
        const rows = await loadAccounts(params);
        return res.json({params, rows});
    } catch (err) {
        debug("get()", err.message);
        return res.json(err);
    }

};

exports.render = async (req, res) => {
    try {
        const {sqlSort, fields, filters, periods} = await parse(req.body, res.locals.profile.user);
        const rows = await loadAccounts({filters, periods, sqlSort});
        debug('render()', rows.length);
        res.render('sales/account-list', {rows: prepForRender(rows), fields, titles, periods});
    } catch (err) {
        debug("render()", err.message);
        res.send(`<div class="alert alert-danger"><strong>Error:</strong> ${err.message}</div>`);
    }
}

exports.xlsx = async (req, res) => {
    try {
        const {sqlSort, fields, filters, periods} = await parse(req.body, res.locals.profile.user);
        const rows = await loadAccounts({filters, periods, sqlSort});
        const columnNames = {};
        fields.forEach(field => {
            columnNames[field] = titles[field](periods);
        });
        const sheet = resultToExcelSheet(rows, columnNames, true);
        const sheets = {'Account List': sheet};
        const workbook = await buildWorkbook(sheets, {
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
