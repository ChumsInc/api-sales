// import Debug from 'debug';
// import {mysql2Pool} from 'chums-local-modules';

const Debug = require('debug');
const {mysql2Pool} = require('chums-local-modules');
const debug = Debug('chums:lib:account:invoices');

/**
 *
 * @param {number} user_id
 * @param {string} Company
 * @param {string} ARDivisionNo
 * @param {string} CustomerNo
 * @param {string} year
 * @param {number|string} [offset]
 * @param {number|string} [limit]
 * @return {Promise<AccountInvoice[]>}
 */
async function loadAccountInvoices({user_id, Company, ARDivisionNo, CustomerNo, year, offset = 0, limit = 1000}) {
    limit = Number(limit) || 1000;
    offset = Number(offset) || 0;

    if (isNaN(offset)) {
        offset = 0;
    }

    if (isNaN(limit) || limit > 1000) {
        limit = 1000;
    }

    try {
        const sql = `
            SELECT h.Company,
                   h.InvoiceNo,
                   h.InvoiceType,
                   h.InvoiceDate,
                   h.CustomerPONo,
                   h.SalesOrderNo,
                   h.OrderType,
                   h.ShipToCode,
                   h.ShipToName,
                   h.ShipToCity,
                   h.ShipToState,
                   h.ShipToZipCode,
                   h.ShipToCountryCode,
                   h.TaxableSalesAmt,
                   h.NonTaxableSalesAmt,
                   h.DiscountAmt,
                   h.FreightAmt
            FROM c2.ar_invoicehistoryheader h
                 INNER JOIN users.user_Account accounts
                            ON accounts.Company = h.Company
                                AND accounts.ARDivisionNo = h.ARDivisionNo
                                AND accounts.CustomerNo = h.CustomerNo
                                AND accounts.ShipToCode = IFNULL(h.ShipToCode, '')

            WHERE h.Company = :Company
              AND h.ARDivisionNo = :ARDivisionNo
              AND h.CustomerNo = :CustomerNo
              AND (IFNULL(:year, '') = '' OR YEAR(InvoiceDate) = :year)
              AND (accounts.userid = :user_id OR accounts.api_id = :api_id)
              AND h.InvoiceType <> 'XD'
            ORDER BY h.InvoiceDate DESC, h.InvoiceNo
            LIMIT :limit OFFSET :offset
        `;

        const args = {Company, ARDivisionNo, CustomerNo, year, user_id: user_id, api_id: user_id * -1, limit, offset};

        const [rows] = await mysql2Pool.query(sql, args);

        rows.forEach(row => {
            row.TaxableSalesAmt = Number(row.TaxableSalesAmt || 0);
            row.NonTaxableSalesAmt = Number(row.NonTaxableSalesAmt || 0);
            row.DiscountAmt = Number(row.DiscountAmt || 0);
            row.FreightAmt = Number(row.FreightAmt || 0);
        });

        return rows;
    } catch (err) {
        debug("loadAccountInvoices()", err.message);
        return Promise.reject(err);
    }
}

async function loadYearInvoiceCount({user_id, Company, ARDivisionNo, CustomerNo}) {
    try {
        const sql = `
            SELECT YEAR(h.InvoiceDate) AS year,
                   COUNT(*)            AS invoices
            FROM c2.ar_invoicehistoryheader h
                 INNER JOIN users.user_Account accounts
                            ON accounts.Company = h.Company
                                AND accounts.ARDivisionNo = h.ARDivisionNo
                                AND accounts.CustomerNo = h.CustomerNo
                                AND accounts.ShipToCode = IFNULL(h.ShipToCode, '')

            WHERE h.Company = :Company
              AND h.ARDivisionNo = :ARDivisionNo
              AND h.CustomerNo = :CustomerNo
              AND (accounts.userid = :user_id OR accounts.api_id = :api_id)
              AND h.InvoiceType <> 'XD'
            GROUP BY YEAR(h.InvoiceDate)
            ORDER BY year DESC
        `;

        const args = {Company, ARDivisionNo, CustomerNo, user_id: user_id, api_id: user_id * -1};

        const [rows] = await mysql2Pool.query(sql, args);
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadYearInvoiceCount()", err.message);
            return Promise.reject(err);
        }
        debug("loadYearInvoiceCount()", err);
        return Promise.reject(new Error('Error in loadYearInvoiceCount()'));
    }
}

exports.loadAccountInvoices = loadAccountInvoices;
exports.loadYearInvoiceCount = loadYearInvoiceCount;
