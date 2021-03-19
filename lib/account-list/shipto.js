const pool = require('chums-base').mysql2Pool;
const debug = require('debug')('chums:lib:sales:accountlist:shipto');
const moment = require('moment');
const numeral = require('numeral');
const {parse, sortFields, fields, titles} = require('./params');
const {buildWorkbook, resultToExcelSheet} = require('../../utils/toXLSX');

const loadAccounts = async (params) => {
    try {
        const limit = params.data.top ? `LIMIT ${params.data.top}` : '';
        const orderBy = params.sort
            .map(({key, value}) => `${sortFields[key]} ${value ? 'ASC' : 'DESC'}`)
            .join(', ');

        const query = `
    SELECT DISTINCT
        c.Company,
        c.ARDivisionNo,
        c.CustomerNo,
        ''                                                    AS ShipToCode,
        concat(c.ARDivisionNo, '-', c.CustomerNo)             AS account,
                    ifnull(b2b.isb2b, '-')                                  AS isb2b,
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
        c.SalespersonDivisionNo,
        c.SalespersonNo,
        concat(c.SalespersonDivisionNo, '-', c.SalespersonNo) AS repno,
        r.SalespersonName,
        c.DateCreated,
        c.CustomerType,
        c.PriceLevel,
        c.DateLastActivity,
        if(0 = :if_p1,
           0,
           IFNULL((SELECT sum(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt)
                   FROM c2.ar_invoicehistoryheader h
                       INNER JOIN users.accounts a
                           ON userid = :userid
                              AND h.Company LIKE a.Company
                              AND h.ardivisionno LIKE a.ARDivisionNo
                              AND ((h.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                   (h.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                   WHERE h.Company = c.Company
                         AND h.ARDivisionNo = c.ardivisionno
                         AND h.CustomerNo = c.customerno
                         AND ShipToCode = ''
                         AND a.primaryAccount = 1
                         AND h.SalespersonDivisionNo = c.SalespersonDivisionNo
                         AND h.SalespersonNo = c.salespersonno
                         AND h.InvoiceDate BETWEEN :minInvoiceDate1 AND :maxInvoiceDate1), 0))
                                                              AS p1,
        if(0 = :if_p2,
           0,
           IFNULL((SELECT sum(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt)
                   FROM c2.ar_invoicehistoryheader h
                       INNER JOIN users.accounts a
                           ON userid = :userid
                              AND h.Company LIKE a.Company
                              AND h.ardivisionno LIKE a.ARDivisionNo
                              AND ((h.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                   (h.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                   WHERE h.Company = c.Company
                         AND h.ARDivisionNo = c.ardivisionno
                         AND h.CustomerNo = c.customerno
                         AND h.ShipToCode = ''
                         AND a.primaryAccount = 1
                         AND h.InvoiceDate BETWEEN :minInvoiceDate2 AND :maxInvoiceDate2), 0)
        )                                                     AS p2,
        if(0 = :if_p3,
           0,
           IFNULL((SELECT sum(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt)
                   FROM c2.ar_invoicehistoryheader h
                       INNER JOIN users.accounts a
                           ON userid = :userid
                              AND h.Company LIKE a.Company
                              AND h.ardivisionno LIKE a.ARDivisionNo
                              AND ((h.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                   (h.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                   WHERE h.Company = c.Company
                         AND h.ARDivisionNo = c.ardivisionno
                         AND h.CustomerNo = c.customerno
                         AND h.ShipToCode = ''
                         AND a.primaryAccount = 1
                         AND h.InvoiceDate BETWEEN :minInvoiceDate3 AND :maxInvoiceDate3), 0)
        )                                                     AS p3
    FROM c2.ar_customer c
        INNER JOIN (SELECT *
                    FROM users.accounts
                    WHERE userid = :userid) a
            ON c.Company LIKE a.Company
               AND c.ardivisionno LIKE a.ARDivisionNo
               AND ((c.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                    (c.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                AND a.primaryAccount = 1
        LEFT JOIN c2.ar_salesperson r
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
                        WHERE u.accountType = 4 and u.active = 1
                        ) b2b
                        ON b2b.Company = c.company AND b2b.ARDivisionNo = c.ARdivisionno AND
                           b2b.CustomerNo = c.CustomerNo
    WHERE c.Company = :company
          AND c.ardivisionno LIKE :div
          AND c.salespersonno LIKE :rep
          AND c.state LIKE :state
          AND c.countrycode LIKE :country
          AND c.CustomerType LIKE :CustomerType
            AND c.CustomerStatus = 'A'
          AND (
              (ISNULL(:createdMin) AND ISNULL(:createdMax))
              OR (ISNULL(:createdMin) = FALSE AND ISNULL(:createdMax) = FALSE AND DateCreated BETWEEN :createdMin AND :createdMax)
              OR (ISNULL(:createdMin) = FALSE AND ISNULL(:createdMax) = TRUE AND DateCreated >= :createdMin)
              OR (ISNULL(:createdMin) = TRUE AND ISNULL(:createdMax) = FALSE AND DateCreated <= :createdMax)
          )
          AND (
              (ISNULL(:activeMin) AND ISNULL(:activeMax))
              OR (ISNULL(:activeMin) = FALSE AND ISNULL(:activeMax) = FALSE AND DateLastActivity BETWEEN :activeMin AND :activeMax)
              OR (ISNULL(:activeMin) = FALSE AND ISNULL(:activeMax) = TRUE AND DateLastActivity >= :activeMin)
              OR (ISNULL(:activeMin) = TRUE AND ISNULL(:activeMax) = FALSE AND DateLastActivity <= :activeMax)
          )
    
    UNION
    
    SELECT DISTINCT
        s.Company,
        s.ARDivisionNo,
        s.CustomerNo,
        s.ShipToCode,
        concat(c.ardivisionno, '-', c.customerno, '[', s.ShipToCode, ']') AS account,
                    ifnull(b2b.isb2b, '')                                  AS isb2b,
        s.ShipToName,
        s.ShipToAddress1,
        s.ShipToAddress2,
        s.ShipToAddress3,
        s.ShipToCity,
        s.ShipToState,
        s.ShipToZipCode,
        s.ShipToCountryCode,
        s.TelephoneNo,
        s.FaxNo,
        s.EmailAddress,
        s.SalespersonDivisionNo,
        s.SalespersonNo,
        concat(s.SalespersonDivisionNo, '-', s.SalespersonNo)             AS repno,
        r.SalespersonName,
        s.DateCreated,
        c.CustomerType,
        c.PriceLevel,
        c.DateLastActivity,
        if(0 = :if_p1,
           0,
           IFNULL((SELECT SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt)
                   FROM c2.ar_invoicehistoryheader h
                       INNER JOIN users.accounts a
                           ON userid = :userid
                              AND h.Company LIKE a.Company
                              AND h.ardivisionno LIKE a.ARDivisionNo
                              AND ((h.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                   (h.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                   WHERE h.Company = s.Company
                         AND h.ARDivisionNo = s.ARDivisionNo
                         AND h.CustomerNo = s.CustomerNo
                         AND h.ShipToCode = s.ShipToCode
                         AND a.primaryAccount = 1
                         AND h.InvoiceDate BETWEEN :minInvoiceDate1 AND :maxInvoiceDate1), 0)
        )                                                                 AS p1,
        if(0 = :if_p2,
           0,
           IFNULL((SELECT SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt)
                   FROM c2.ar_invoicehistoryheader h
                       INNER JOIN users.accounts a
                           ON userid = :userid
                              AND h.Company LIKE a.Company
                              AND h.ardivisionno LIKE a.ARDivisionNo
                              AND ((h.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                   (h.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                   WHERE h.Company = c.Company
                         AND h.ARDivisionNo = s.ARDivisionNo
                         AND h.CustomerNo = s.CustomerNo
                         AND h.ShipToCode = s.ShipToCode
                         AND a.primaryAccount = 1
                         AND h.InvoiceDate BETWEEN :minInvoiceDate2 AND :maxInvoiceDate2), 0)
        )                                                                 AS p2,
        if(0 = :if_p3,
           0,
           IFNULL((SELECT SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt)
                   FROM c2.ar_invoicehistoryheader h
                       INNER JOIN users.accounts a
                           ON userid = :userid
                              AND h.Company LIKE a.Company
                              AND h.ardivisionno LIKE a.ARDivisionNo
                              AND ((h.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                                   (h.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                   WHERE h.Company = c.Company
                         AND h.ARDivisionNo = s.ARDivisionNo
                         AND h.CustomerNo = s.CustomerNo
                         AND h.ShipToCode = s.ShipToCode
                         AND a.primaryAccount = 1
                         AND h.InvoiceDate BETWEEN :minInvoiceDate3 AND :maxInvoiceDate3), 0)
        )                                                                 AS p3
    FROM c2.so_shiptoaddress s
        INNER JOIN c2.ar_customer c
            ON c.Company = s.Company
               AND c.ardivisionno = s.ARDivisionNo
               AND c.customerno = s.CustomerNo
        INNER JOIN users.accounts a
            ON userid = :userid
               AND s.Company LIKE a.Company
               AND s.ardivisionno LIKE a.ARDivisionNo
               AND ((s.salespersonno LIKE a.CustomerNo AND a.isRepAccount = 1) OR
                    (s.customerno LIKE a.CustomerNo AND a.isRepAccount = 0))
                AND a.primaryAccount = 1
        LEFT JOIN c2.ar_salesperson r
            ON r.Company = s.Company
               AND r.SalespersonDivisionNo = s.SalespersonDivisionNo
               AND r.SalespersonNo = s.SalespersonNo
    LEFT JOIN  (
                        SELECT DISTINCT c.company, c.ARDivisionNo, c.CustomerNo, 'YES' AS isb2b
                        FROM users.users u
                             INNER JOIN users.accounts a
                                        ON a.userid = u.id
                             INNER JOIN c2.ar_customer c
                                        ON c.Company = a.Company AND c.ARDivisionNo = a.ARDivisionNo AND
                                           c.CustomerNo = a.CustomerNo
                        WHERE u.accountType = 4 and u.active = 1
                        ) b2b
                        ON b2b.Company = c.company AND b2b.ARDivisionNo = c.ARdivisionno AND
                           b2b.CustomerNo = c.CustomerNo
    WHERE s.Company = :company
          AND s.ARDivisionNo LIKE :div
          AND (s.SalespersonNo LIKE :rep OR r.SalesManagerNo LIKE :rep)
          AND s.ShipToState LIKE :state
          AND c.CustomerType LIKE :CustomerType
          AND s.ShipToCountryCode LIKE :country
          AND c.CustomerStatus = 'A'
         AND (
              (ISNULL(:createdMin) AND ISNULL(:createdMax))
              OR (ISNULL(:createdMin) = FALSE AND ISNULL(:createdMax) = FALSE AND c.DateCreated BETWEEN :createdMin AND :createdMax)
              OR (ISNULL(:createdMin) = FALSE AND ISNULL(:createdMax) = TRUE AND c.DateCreated >= :createdMin)
              OR (ISNULL(:createdMin) = TRUE AND ISNULL(:createdMax) = FALSE AND c.DateCreated <= :createdMax)
          )
          AND (
              (ISNULL(:activeMin) AND ISNULL(:activeMax))
              OR (ISNULL(:activeMin) = FALSE AND ISNULL(:activeMax) = FALSE AND DateLastActivity BETWEEN :activeMin AND :activeMax)
              OR (ISNULL(:activeMin) = FALSE AND ISNULL(:activeMax) = TRUE AND DateLastActivity >= :activeMin)
              OR (ISNULL(:activeMin) = TRUE AND ISNULL(:activeMax) = FALSE AND DateLastActivity <= :activeMax)
          )
    ORDER BY ${orderBy}
    LIMIT ${params.data.top || 1000}
    `;
        // debug('loadAccounts() query', params.data);

        const timing = {start: new Date()};
        const connection = await pool.getConnection();
        timing.connection = new Date();
        const [rows] = await connection.query(query, params.data);
        timing.rows = new Date();
        connection.release();
        timing.release = new Date();
        // console.log('loadAccounts', rows.length);
        rows.map(row => {
            row.p1 = Number(row.p1);
            row.p2 = Number(row.p2);
            row.p3 = Number(row.p3);
        });
        timing.done = new Date();
        return {rows, params, timing, query};
    } catch (err) {
        debug("loadAccounts", err.message);
        return Promise.reject(err);
    }

};

const prepForRender = (rows) => {
    return rows.map(row => {
        return Object.assign(row, {
            DateCreated: row.DateCreated ? moment(row.DateCreated).format('MM-DD-Y') : null,
            DateLastActivity: row.DateLastActivity ? moment(row.DateLastActivity).format('MM-DD-Y') : null,
            p1: numeral(row.p1).format('0,0.00'),
            p2: numeral(row.p2).format('0,0.00'),
            p3: numeral(row.p3).format('0,0.00'),
        })
    });
};

const prepForXLSX = ({rows, params}) => {
    const colsToRemove = [];
    params.fields
        .filter(f => f.value === false)
        .forEach(f => colsToRemove.push(...fields[f.key]));

    return rows.map(row => {
        colsToRemove.forEach(f => {
            delete row[f];
        });
        return row;
    })
};

exports.get = (req, res) => {
    parse(req.query, res.locals.user)
        .then(data => {
            return loadAccounts(data);
        })
        .then(result => {
            res.jsonp({result});
        })
        .catch(err => {
            res.jsonp({error: err.message});
        })
};

exports.render = async (req, res) => {
    try {
        const _params = await parse({...req.body, ...req.query}, res.locals.user);
        const {params, rows: _rows, timing, query} = await loadAccounts(_params);
        const rows = prepForRender(_rows);
        res.render('sales/account-list', {params, rows, timing, fields, titles, query});
    } catch (err) {
        debug("render()", err.message);
        res.send(`<div class="alert alert-danger"><strong>Error:</strong> ${err.message}</div>`);
    }
};

exports.xlsx = async (req, res) => {
    try {
        const _params = await parse({...req.body, ...req.query}, res.locals.user);
        const {params, rows: _rows, timing, query} = await loadAccounts(_params);
        const rows = prepForXLSX({rows: _rows, params});
        const columnNames = {};
        params.fields
            .filter(f => f.value === true)
            .forEach(f => {
                fields[f.key].forEach(col => {
                    columnNames[col] = titles[col](params.data)
                });
            });
        const sheet = await resultToExcelSheet(rows, columnNames);
        const sheets = {'Account List': sheet};
        const workbook = await buildWorkbook(sheets, {bookType: 'xlsx', bookSST: true, type: 'buffer', compression: true});
        const filename = new Date().toISOString();
        res.setHeader('Content-disposition', `attachment; filename=AccountList-${filename}.xlsx`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(workbook);
    } catch(err) {
        debug("xlsx()", err.message);
        return err;
    }
};
