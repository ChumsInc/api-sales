/**
 * Created by steve on 3/7/2017.
 */
const debug = require('debug')('chums:lib:b2b:orders');
const {mysql2Pool} = require('chums-local-modules');
const {addSeconds} = require('date-fns');


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

/**
 *
 * @param {Object} params
 * @param {string} params.Company
 * @param {string} [params.OrderType]
 * @param {string} [params.SalesOrderNo]
 * @return {Promise<*>}
 */
async function loadOrders(params) {
    try {
        // initial fixing of parameters for options -- maybe not needed now
        if (!params.OrderType && !params.SalesOrderNo) {
            params.OrderType = '[SBQ]';
        } else if (params.SalesOrderNo) {
            params.OrderType = '';
        }
        if (!!params.OrderType && params.OrderType.length > 1) {
            params.OrderType = `[${params.OrderType.replace(/[\[\]]/g, '')}]`;
        }
        const {Company, OrderType, SalesOrderNo} = params;
        debug('loadOrders()', params);

        const query = `SELECT l.Company,
                              l.SalesOrderNo,
                              hh.OrderStatus,
                              IFNULL(h.OrderType, 'C')                AS OrderType,
                              hh.OrderDate,
                              h.ShipExpireDate,
                              hh.ARDivisionNo,
                              hh.CustomerNo,
                              hh.BillToName,
                              hh.ShipToCode,
                              hh.ShipToName,
                              hh.ShipToCity,
                              hh.ShipToState,
                              hh.ShipToZipCode,
                              hh.ShipVia,
                              hh.CustomerPONo,
                              hh.FOB,
                              h.CurrentInvoiceNo,
                              hh.SalespersonDivisionNo,
                              hh.SalespersonNo,
                              hh.CancelReasonCode,
                              hh.DiscountAmt,
                              hh.TaxableAmt,
                              hh.NonTaxableAmt,
                              hh.SalesTaxAmt,
                              hh.OrderTotal,
                              hh.UDF_IMPRINTED                        AS UDF_IMPRINTED,
                              NULLIF(hh.UDF_CANCEL_DATE, '0000-00-00') AS UDF_CANCEL_DATE,
                              hh.DateCreated,
                              h.TimeCreated,
                              hh.DateUpdated,
                              h.TimeUpdated,
                              hh.UserUpdatedKey,
                              sy.userlogon                            AS UserUpdated,
                              hh.Comment,
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
                            INNER JOIN c2.SO_SalesOrderHistoryHeader hh
                                       ON hh.Company = l.dbCompany AND hh.SalesOrderNo = l.SalesOrderNo
                            LEFT JOIN  c2.SO_SalesOrderHeader h
                                       ON h.Company = hh.Company AND h.SalesOrderNo = hh.SalesOrderNo
                            INNER JOIN c2.sy_user sy
                                       ON sy.userkey = hh.UserUpdatedKey
                       WHERE l.Company = :Company
                         AND (IFNULL(:OrderType, '') = '' OR h.OrderType REGEXP :OrderType)
                         AND (IFNULL(:SalesOrderNo, '') = '' OR hh.SalesOrderNo = :SalesOrderNo)
        `;
        const data = {Company, OrderType, SalesOrderNo};
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => {
            try {
                row.b2bAction = JSON.parse(row.b2bAction);
            } catch (err) {
                debug("loadOrders()", err.message, row.Company, row.SalesOrderNo);
                row.b2bAction = {error: 'Invalid Action', oldAction: row.b2bAction};
            }
            row.DateCreated = SageTime(row.DateCreated, row.TimeCreated || 8);
            row.DateUpdated = SageTime(row.DateUpdated, row.TimeUpdated || 8);
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
        let history;
        if (req.params.SalesOrderNo && result.length === 1) {
            history = await loadOrderHistory(req.params)
        }
        res.json({result, history});
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
