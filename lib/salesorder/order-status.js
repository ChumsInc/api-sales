import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear.js'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'

dayjs.extend(weekOfYear);
dayjs.extend(dayOfYear);

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
           uc.firstname                                      AS CreatedByUser,
           uu.firstname                                      AS UpdatedByUser,
           YEARWEEK(hh.OrderDate)                            AS OrderWeek,
           YEARWEEK(hh.ShipExpireDate)                       AS ShipWeek
    FROM c2.SO_SalesOrderHistoryHeader hh
             LEFT JOIN c2.SO_SalesOrderHeader soh
                       ON soh.Company = hh.Company AND soh.SalesOrderNo = hh.SalesOrderNo
             LEFT JOIN c2.sy_user uc
                       ON uc.userkey = hh.UserCreatedKey
             LEFT JOIN c2.sy_user uu
                       ON uu.userkey = hh.UserUpdatedKey
             LEFT JOIN c2.so_cancelreasoncode s
                       ON s.Company = soh.Company AND s.CancelReasonCode = soh.CancelReasonCode
    WHERE hh.OrderStatus IN ('A', 'C')
      AND hh.Company = :Company
      AND IF(IFNULL(:dateType, '') = 'od', hh.OrderDate BETWEEN :minDate AND :maxDate,
             hh.ShipExpireDate BETWEEN :minDate AND :maxDate)
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
           uc.firstname                 AS CreatedByUser,
           uu.firstname                 AS UpdatedByUser,
           YEARWEEK(soh.OrderDate)      AS OrderWeek,
           YEARWEEK(soh.ShipExpireDate) AS ShipWeek
    FROM c2.SO_SalesOrderHeader soh
             INNER JOIN c2.sy_user uc
                        ON uc.userkey = soh.UserCreatedKey
             LEFT JOIN c2.sy_user uu
                       ON uu.userkey = soh.UserUpdatedKey
             LEFT JOIN c2.so_cancelreasoncode s
                       ON s.Company = soh.Company AND s.CancelReasonCode = soh.CancelReasonCode
    WHERE soh.OrderType IN ('M')
      AND soh.Company = :Company
      AND IF(IFNULL(:dateType, '') = 'od', soh.OrderDate BETWEEN :minDate AND :maxDate,
             soh.ShipExpireDate BETWEEN :minDate AND :maxDate)
      AND (IFNULL(:filterDivision, '') = '' OR soh.ARDivisionNo = :filterDivision)
      AND (IFNULL(:filterRep, '') = '' OR soh.SalespersonNo = :filterRep)
`;


/**
 * Note: this is not filtered by user roles, so data is only for employees
 */
async function loadOrderStatusList({Company, dateType, minDate, maxDate, filterDivision, filterRep}) {
    try {
        const data = {Company, dateType, minDate, maxDate, filterDivision, filterRep};
        const [rows] = await mysql2Pool.query(queryOrders, data);
        return rows.map(row => ({
            ...row,
            OrderTotal: Number(row.OrderTotal),
            week: dayjs(row.OrderDate).week(), //getWeek(new Date(row.OrderDate)),
            day: dayjs(row.OrderDate).dayOfYear(), //getDayOfYear(new Date(row.OrderDate)),
        }))
    } catch (err) {
        debug("loadOrderList()", err.message);
        return err;
    }
}

export async function getOrderStatusList(req, res) {
    try {
        // debug('getOrderList()', res.locals);
        const orders = await loadOrderStatusList({...req.query, ...req.params});
        res.json({orders});
    } catch (err) {
        debug("getOrderList()", err.message);
        res.json({error: err.message});
    }
}

