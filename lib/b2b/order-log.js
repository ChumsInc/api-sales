import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';
import {addSeconds} from 'date-fns';

/**
 * Created by steve on 3/7/2017.
 */
const debug = Debug('chums:lib:b2b:orders');


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
 * @param {Number[]} idList
 * @returns {Promise<*>}
 */
async function loadOrderUsers(idList = []) {
    try {
        if (idList.length === 0) {
            return [];
        }
        const query = `SELECT id, name, company, accountType
                       FROM users.users
                       WHERE id IN (:idList)`;
        const data = {idList};
        const [users] = await mysql2Pool.query(query, data);
        return users;
    } catch (err) {
        debug("loadOrderUsers()", err.message);
        return err;
    }
}

async function loadOrderUserStats({userId, Company, minDate, maxDate}) {
    try {
        const query = `
            SELECT l.Company,
                   h.ARDivisionNo,
                   h.CustomerNo,
                   h.BillToName,
                   l.SalesOrderNo,
                   l.OrderStatus                                AS b2bStatus,
                   h.OrderStatus,
                   h.OrderDate,
                   ifnull(oh.ShipExpireDate, h.LastInvoiceDate) AS ShipExpireDate,
                   h.TaxableAmt + h.NonTaxableAmt               AS OrderTotal,
                   l.Notes                                      AS b2bNotes,
                   u.id                                         AS UserID,
                   ifnull(u.name, a.clientName)                 AS b2bName,
                   l.action                                     AS b2bAction,
                   l.timestamp,
                   h.SalespersonDivisionNo,
                   h.SalespersonNo,
                   r.SalespersonName
            FROM b2b.SalesOrderLog l
                     INNER JOIN c2.SO_SalesOrderHistoryHeader h
                                ON h.Company = l.dbCompany AND h.SalesOrderNo = l.SalesOrderNo
                     INNER JOIN users.user_AR_Customer c
                                ON c.userid = :userId AND c.Company = h.Company AND c.ARDivisionNo = h.ARDivisionNo AND
                                   c.CustomerNo = h.CustomerNo
                     LEFT JOIN users.users u
                               ON l.UserID = u.id
                     LEFT JOIN users.api_access a
                               ON a.id_api_access = abs(l.UserID)
                     LEFT JOIN c2.ar_salesperson r
                               ON r.Company = h.Company
                                   AND r.SalespersonDivisionNo = h.SalespersonDivisionNo
                                   AND r.SalespersonNo = h.SalespersonNo
                     LEFT JOIN c2.SO_SalesOrderHeader oh
                               ON oh.Company = h.Company AND oh.SalesOrderNo = h.SalesOrderNo
            WHERE l.Company = :Company
              AND h.OrderDate BETWEEN :minDate AND :maxDate
              AND h.OrderStatus NOT IN ('X', 'Z')

            UNION

            SELECT l.Company,
                   h.ARDivisionNo,
                   h.CustomerNo,
                   h.BillToName,
                   l.SalesOrderNo,
                   l.OrderStatus                                AS b2bStatus,
                   h.OrderStatus,
                   h.OrderDate,
                   ifnull(oh.ShipExpireDate, h.LastInvoiceDate) AS ShipExpireDate,
                   h.TaxableAmt + h.NonTaxableAmt               AS OrderTotal,
                   l.Notes                                      AS b2bNotes,
                   u.id                                         AS UserID,
                   ifnull(u.name, a.clientName)                 AS b2bName,
                   l.action                                     AS b2bAction,
                   l.original_timestamp,
                   h.SalespersonDivisionNo,
                   h.SalespersonNo,
                   r.SalespersonName
            FROM b2b.SalesOrderHistory l
                     INNER JOIN c2.SO_SalesOrderHistoryHeader h
                                ON h.Company = l.dbCompany AND h.SalesOrderNo = l.SalesOrderNo
                     INNER JOIN users.user_AR_Customer c
                                ON c.userid = :userId AND c.Company = h.Company AND c.ARDivisionNo = h.ARDivisionNo AND
                                   c.CustomerNo = h.CustomerNo
                     LEFT JOIN c2.SO_SalesOrderHeader oh
                               ON oh.Company = h.Company AND oh.SalesOrderNo = h.SalesOrderNo
                     LEFT JOIN users.users u
                               ON l.UserID = u.id
                     LEFT JOIN users.api_access a
                               ON a.id_api_access = abs(l.UserID)
                     LEFT JOIN c2.ar_salesperson r
                               ON r.Company = h.Company
                                   AND r.SalespersonDivisionNo = h.SalespersonDivisionNo
                                   AND r.SalespersonNo = h.SalespersonNo
            WHERE l.Company = :Company
              AND h.OrderDate BETWEEN :minDate AND :maxDate
              AND h.OrderStatus NOT IN ('X', 'Z')

            ORDER BY SalesOrderNo, timestamp DESC`;
        const args = {userId, Company, minDate, maxDate};
        const [rows] = await mysql2Pool.query(query, args);
        const _orders = {};
        const userIds = [];
        rows
            .map(row => {
                try {
                    row.OrderTotal = Number(row.OrderTotal);
                    row.b2bAction = JSON.parse(row.b2bAction);
                } catch (err) {
                    debug("loadOrderUserStats() parseRows", row.SalesOrderNo, err.message);
                    row.b2bAction = {error: err.message};
                }
                return row;
            })
            .filter(row => row.b2bAction.action !== 'print')
            .forEach(row => {
                const {
                    ARDivisionNo, CustomerNo, BillToName, SalesOrderNo, OrderDate, ShipExpireDate,
                    OrderStatus, OrderTotal, UserID, SalespersonDivisionNo, SalespersonNo, SalespersonName
                } = row;
                if (!userIds.includes(UserID)) {
                    userIds.push(UserID);
                }
                if (_orders[row.SalesOrderNo] === undefined) {
                    _orders[row.SalesOrderNo] = {
                        ARDivisionNo,
                        CustomerNo,
                        BillToName,
                        SalesOrderNo,
                        OrderStatus,
                        OrderDate,
                        ShipExpireDate,
                        OrderTotal,
                        SalespersonDivisionNo,
                        SalespersonNo,
                        SalespersonName,
                        users: []
                    };
                }
                if (!_orders[row.SalesOrderNo].users.includes(UserID)) {
                    _orders[row.SalesOrderNo].users.push(UserID);
                }
            });
        const orders = Object.keys(_orders).map(key => _orders[key]);
        const users = await loadOrderUsers(userIds);
        users.forEach(user => {
            user.orders = orders.filter(order => order.users.includes(user.id));
            user.totals = {cart: 0, open: 0, closed: 0};
            user.orders.forEach(order => {
                switch (order.OrderStatus) {
                    case 'Q':
                        user.totals.cart += order.OrderTotal;
                        break;
                    case 'C':
                        user.totals.closed += order.OrderTotal;
                        break;
                    default:
                        user.totals.open += order.OrderTotal;
                }
            });
        })
        return {orders, users};
    } catch (err) {
        debug("loadOrderUserStats()", err.message);
        return err;
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
                              IFNULL(h.OrderStatus, hh.OrderStatus)        AS OrderStatus,
                              IFNULL(h.OrderType, 'C')                     AS OrderType,
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
                              ifnull(h.CurrentInvoiceNo, hh.LastInvoiceNo) as CurrentInvoiceNo,
                              hh.SalespersonDivisionNo,
                              hh.SalespersonNo,
                              hh.CancelReasonCode,
                              hh.DiscountAmt,
                              hh.TaxableAmt,
                              hh.NonTaxableAmt,
                              hh.SalesTaxAmt,
                              hh.OrderTotal,
                              hh.UDF_IMPRINTED                             AS UDF_IMPRINTED,
                              NULLIF(hh.UDF_CANCEL_DATE, '0000-00-00')     AS UDF_CANCEL_DATE,
                              hh.DateCreated,
                              h.TimeCreated,
                              hh.DateUpdated,
                              h.TimeUpdated,
                              hh.UserUpdatedKey,
                              sy.userlogon                                 AS UserUpdated,
                              hh.Comment,
                              l.OrderStatus                                AS b2bStatus,
                              l.Notes                                      AS b2bNotes,
                              IFNULL(u.name, a.clientName)                 AS b2bName,
                              l.action                                     AS b2bAction,
                              l.timestamp
                       FROM b2b.SalesOrderLog l
                                LEFT JOIN users.users u
                                          ON l.UserID = u.id
                                LEFT JOIN users.api_access a
                                          ON a.id_api_access = ABS(l.UserID)
                                INNER JOIN c2.SO_SalesOrderHistoryHeader hh
                                           ON hh.Company = l.dbCompany AND hh.SalesOrderNo = l.SalesOrderNo
                                LEFT JOIN c2.SO_SalesOrderHeader h
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
            row.DiscountAmt = Number(row.DiscountAmt);
            row.TaxableAmt = Number(row.TaxableAmt);
            row.NonTaxableAmt = Number(row.NonTaxableAmt);
            row.OrderTotal = Number(row.OrderTotal);
            row.OrderTotal = row.OrderTotal || (row.TaxableAmt + row.NonTaxableAmt - row.DiscountAmt)
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
                              l.OrderStatus                                                  AS b2bStatus,
                              l.Notes                                                        AS b2bNotes,
                              IFNULL(IF(u.accountType = 4, u.company, u.name), a.clientName) AS b2bName,
                              l.action                                                       AS b2bAction,
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
                              l.OrderStatus                                                  AS b2bStatus,
                              l.Notes                                                        AS b2bNotes,
                              IFNULL(IF(u.accountType = 4, u.company, u.name), a.clientName) AS b2bName,
                              l.action                                                       AS b2bAction,
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

export const getOrders = async (req, res) => {
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

export const getOrderHistory = async (req, res) => {
    try {
        const result = await loadOrderHistory(req.params);
        res.json({result})
    } catch (err) {
        debug("getOrderHistory()", err.message);
        res.json({error: err.message});
    }
}


export const getOrderUserStats = async (req, res) => {
    try {
        const orders = await loadOrderUserStats({...req.params, userId: res.locals.profile?.user?.id});
        res.json(orders);
    } catch (err) {
        debug("getOrderUserStats()", err.message);
        res.json({error: err.message});
    }
}
