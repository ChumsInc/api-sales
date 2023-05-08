import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
import {getDayOfYear, getWeek} from 'date-fns';

const debug = Debug('chums:lib:sales:salesorder:order-status');

const queryOrders = `
    SELECT hh.SalesOrderNo,
           hh.OrderDate,
           soh.OrderType,
           hh.OrderStatus,
           soh.CancelReasonCode,
           s.CancelReasonCodeDesc,
           soh.ShipExpireDate,
           hh.UDF_IMPRINTED,
           hh.ARDivisionNo,
           hh.CustomerNo,
           hh.BillToName,
           hh.BillToCity,
           hh.BillToState,
           hh.BillToCountryCode,
           hh.ShipToCode,
           hh.ShipToName,
           hh.ShipToCity,
           hh.ShipToState,
           hh.ShipToCountryCode,
           soh.CurrentInvoiceNo,
           hh.TaxableAmt + hh.NonTaxableAmt - hh.DiscountAmt AS OrderTotal,
           hh.LastInvoiceNo,
           hh.LastInvoiceDate,
           hh.SalespersonDivisionNo,
           hh.SalespersonNo,
           uac.userid,
           uc.firstname                                      AS CreatedByUser,
           uu.firstname                                      AS UpdatedByUser,
           YEARWEEK(hh.OrderDate)                            AS OrderWeek,
           YEARWEEK(soh.ShipExpireDate)                      AS ShipWeek
    FROM c2.SO_SalesOrderHistoryHeader hh
             INNER JOIN c2.sy_user uc
                        ON uc.userkey = hh.UserCreatedKey
             LEFT JOIN c2.sy_user uu
                       ON uu.userkey = hh.UserUpdatedKey
             INNER JOIN c2.ar_division d
                        ON d.Company = hh.Company AND d.ARDivisionNo = hh.ARDivisionNo
             INNER JOIN (SELECT DISTINCT userid, Company, ARDivisionNo, CustomerNo, ShipToCode
                         FROM users.user_AR_Customer
                         WHERE userid = :user_id
                         UNION
                         SELECT DISTINCT userid, Company, ARDivisionNo, CustomerNo, ShipToCode
                         FROM users.user_SO_ShipToAddress
                         WHERE userid = :user_id) uac
                        ON uac.Company = hh.Company
                            AND uac.ARDivisionNo = hh.ARDivisionNo
                            AND uac.CustomerNo = hh.CustomerNo
                            AND uac.ShipToCode = hh.ShipToCode

             LEFT JOIN c2.SO_SalesOrderHeader soh
                       ON soh.Company = hh.Company AND soh.SalesOrderNo = hh.SalesOrderNo
             LEFT JOIN c2.so_cancelreasoncode s
                       ON s.Company = soh.Company AND s.CancelReasonCode = soh.CancelReasonCode
    WHERE hh.OrderStatus IN ('A', 'C')
      AND hh.Company = :Company
      AND (:dateType <> 'od' OR hh.OrderDate BETWEEN :minDate AND :maxDate)
      AND (:dateType <> 'sd' OR soh.ShipExpireDate BETWEEN :minDate AND :maxDate)
      AND (IFNULL(:filterDivision, '') = '' OR hh.ARDivisionNo = :filterDivision)
      AND (IFNULL(:filterRep, '') = '' OR hh.SalespersonNo = :filterRep)

    UNION

    SELECT soh.SalesOrderNo,
           soh.OrderDate,
           soh.OrderType,
           soh.OrderStatus,
           soh.CancelReasonCode,
           s.CancelReasonCodeDesc,
           soh.ShipExpireDate,
           soh.imprinted                AS UDF_IMPRINTED,
           soh.ARDivisionNo,
           soh.CustomerNo,
           soh.BillToName,
           soh.BillToCity,
           soh.BillToState,
           soh.BillToCountryCode,
           soh.ShipToCode,
           soh.ShipToName,
           soh.ShipToCity,
           soh.ShipToState,
           soh.ShipToCountryCode,
           soh.CurrentInvoiceNo,
           soh.OrderTotal,
           soh.LastInvoiceNo,
           NULL                         AS LastInvoiceDate,
           soh.SalespersonDivisionNo,
           soh.SalespersonNo,
           uac.userid,
           uc.firstname                 AS CreatedByUser,
           uu.firstname                 AS UpdatedByUser,
           YEARWEEK(soh.OrderDate)      AS OrderWeek,
           YEARWEEK(soh.ShipExpireDate) AS ShipWeek
    FROM c2.SO_SalesOrderHeader soh
             INNER JOIN c2.sy_user uc
                        ON uc.userkey = soh.UserCreatedKey
             LEFT JOIN c2.sy_user uu
                       ON uu.userkey = soh.UserUpdatedKey
             INNER JOIN c2.ar_division d
                        ON d.Company = soh.Company AND d.ARDivisionNo = soh.ARDivisionNo
             INNER JOIN (SELECT DISTINCT userid, Company, ARDivisionNo, CustomerNo, ShipToCode
                         FROM users.user_AR_Customer
                         WHERE userid = :user_id
                         UNION
                         SELECT DISTINCT userid, Company, ARDivisionNo, CustomerNo, ShipToCode
                         FROM users.user_SO_ShipToAddress
                         WHERE userid = :user_id) uac
                        ON uac.Company = soh.Company
                            AND uac.ARDivisionNo = soh.ARDivisionNo
                            AND uac.CustomerNo = soh.CustomerNo
                            AND uac.ShipToCode = soh.ShipToCode
             LEFT JOIN c2.so_cancelreasoncode s
                       ON s.Company = soh.Company AND s.CancelReasonCode = soh.CancelReasonCode
    WHERE soh.OrderType IN ('M')
      AND soh.Company = :Company
      AND (:dateType <> 'od' OR soh.OrderDate BETWEEN :minDate AND :maxDate)
      AND (:dateType <> 'sd' OR soh.ShipExpireDate BETWEEN :minDate AND :maxDate)
      AND (IFNULL(:filterDivision, '') = '' OR soh.ARDivisionNo = :filterDivision)
      AND (IFNULL(:filterRep, '') = '' OR soh.SalespersonNo = :filterRep)
`;

async function loadOrderStatusList({Company, user_id, dateType, minDate, maxDate, filterDivision, filterRep}) {
    try {
        const data = {Company, user_id, dateType, minDate, maxDate, filterDivision, filterRep};
        const [rows] = await mysql2Pool.query(queryOrders, data);
        rows.forEach(row => {
            const d = new Date(row.OrderDate);
            row.OrderTotal = Number(row.OrderTotal);
            row.week = getWeek(d);
            row.day = getDayOfYear(d);
        })
        return rows;
    } catch (err) {
        debug("loadOrderList()", err.message);
        return err;
    }
}

export async function getOrderStatusList(req, res) {
    try {
        // debug('getOrderList()', res.locals);
        const user_id = res.locals.profile.user.id;
        const orders = await loadOrderStatusList({...req.query, ...req.params, user_id});
        res.json({orders});
    } catch (err) {
        debug("getOrderList()", err.message);
        res.json({error: err.message});
    }
}

