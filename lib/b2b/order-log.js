/**
 * Created by steve on 3/7/2017.
 */
const debug = require('debug')('chums:lib:b2b:orders');
const {mysql2Pool} = require('chums-local-modules');
const {parseISO, formatISO9075, addSeconds} = require('date-fns');


function SageTime(sageDate, sageTime) {
    try {
        const seconds = Number.parseFloat(sageTime) * 3600;
        const date = new Date(sageDate);
        const timestamp = addSeconds(date, seconds);
        return timestamp.toISOString();
    } catch (err) {
        debug("SageTime()", err.message, {sageDate, sageTime});
        return Promise.reject(err);
    }
}

async function loadOrders(params) {
    try {
        const query = `SELECT l.Company,
                              l.SalesOrderNo,
                              h.OrderStatus,
                              h.OrderType,
                              h.OrderDate,
                              h.ShipExpireDate,
                              h.ARDivisionNo,
                              h.CustomerNo,
                              h.BillToName,
                              h.ShipToCode,
                              h.ShipToName,
                              h.ShipToCity,
                              h.ShipToState,
                              h.ShipToZipCode,
                              h.ShipVia,
                              h.CustomerPONo,
                              h.FOB,
                              h.CurrentInvoiceNo,
                              h.SalespersonDivisionNo,
                              h.SalespersonNo,
                              h.CancelReasonCode,
                              h.DiscountAmt,
                              h.TaxableAmt,
                              h.NonTaxableAmt,
                              h.SalesTaxAmt,
                              h.OrderTotal,
                              h.imprinted                             AS UDF_IMPRINTED,
                              NULLIF(h.UDF_CANCEL_DATE, '0000-00-00') AS UDF_CANCEL_DATE,
                              h.DateCreated,
                              h.TimeCreated,
                              h.DateUpdated,
                              h.TimeUpdated,
                              h.UserUpdatedKey,
                              sy.userlogon                            AS UserUpdated,
                              h.Comment,
                              l.OrderStatus                           AS b2bStatus,
                              l.Notes                                 AS b2bNotes,
                              IFNULL(u.name, a.clientName)            AS b2bName,
                              l.action                                AS b2bAction,                        
                              l.timestamp
                       FROM b2b.SalesOrderLog l
                            LEFT JOIN  users.users u
                                       ON l.UserID = u.id
                            LEFT JOIN  users.api_access a
                                       ON a.id_api_access = ABS(l.UserID)
                            INNER JOIN c2.SO_SalesOrderHeader h
                                       ON h.Company = b2b.dbCompany(l.Company) AND h.SalesOrderNo = l.SalesOrderNo
                            INNER JOIN c2.sy_user sy
                                       ON sy.userkey = h.UserUpdatedKey
                       WHERE l.Company = :Company
        `;
        const data = {Company: params.Company};
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            try {
                row.b2bAction = JSON.parse(row.b2bAction);
            } catch (err) {
                debug("loadOrders()", err.message, row.Company, row.SalesOrderNo);
                row.b2bAction = {error: 'Invalid Action', oldAction: row.b2bAction};
            }
            row.DateCreated = SageTime(row.DateCreated, row.TimeCreated);
            row.DateUpdated = SageTime(row.DateUpdated, row.TimeUpdated);
            row.DiscountAmount = Number(row.DiscountAmount);
            row.NonTaxableAmt = Number(row.NonTaxableAmt);
            row.OrderTotal = Number(row.OrderTotal);
            row.TaxableAmt = Number(row.TaxableAmt);
            row.SalesTaxAmt = Number(row.SalesTaxAmt);
            delete row.TimeCreated;
            delete row.TimeUpdated;
            return row;
        });
    } catch (err) {
        debug("loadOrders()", err.message);
        return Promise.reject(err);
    }
}

async function loadOrderHistory(params) {
    try {
        const query = `SELECT l.id,
                              l.Company,
                              l.SalesOrderNo,
                              l.OrderStatus                AS b2bStatus,
                              l.Notes                      AS b2bNotes,
                              IFNULL(u.name, a.clientName) AS b2bName,
                              l.action                     AS b2bAction,
                              l.timestamp
                       FROM b2b.SalesOrderLog l
                            LEFT JOIN users.users u
                                      ON l.UserID = u.id
                            LEFT JOIN users.api_access a
                                      ON a.id_api_access = ABS(l.UserID)
                       WHERE l.Company = :Company
                         AND SalesOrderNo = :SalesOrderNo

                       UNION

                       SELECT l.id,
                              l.Company,
                              l.SalesOrderNo,
                              l.OrderStatus                AS b2bStatus,
                              l.Notes                      AS b2bNotes,
                              IFNULL(u.name, a.clientName) AS b2bName,
                              l.action                     AS b2bAction,
                              l.original_timestamp
                       FROM b2b.SalesOrderHistory l
                            LEFT JOIN users.users u
                                      ON l.UserID = u.id
                            LEFT JOIN users.api_access a
                                      ON a.id_api_access = ABS(l.UserID)
                       WHERE l.Company = :Company
                         AND SalesOrderNo = :SalesOrderNo

                       ORDER BY timestamp DESC`;
        const data = {Company: params.Company, SalesOrderNo: params.SalesOrderNo};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            try {
                row.b2bAction = JSON.parse(row.b2bAction);
            } catch (err) {
                row.b2bAction = {error: 'Invalid Action', oldAction: row.b2bAction};
            }
        });
        return rows;
    } catch (err) {
        debug("loadOrderHistory()", err.message);
        return Promise.reject(err);
    }
}

exports.getOrders = async (req, res) => {
    try {
        const result = await loadOrders(req.params);
        res.json({result});
    } catch (err) {
        debug("getOrders()", err.message);
        res.json({error: err.message});
    }
};

exports.getOrderHistory = async (req, res) => {
    try {
        const result = await loadOrderHistory(req.params);
        res.json({result})
    } catch (err) {
        debug("getOrderHistory()", err.message);
        res.json({error: err.message});
    }
}
