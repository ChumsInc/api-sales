import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear.js'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'
import {OrdersByPeriodRecord} from "./types.js";
import {RowDataPacket} from "mysql2";
import {Request, Response} from "express";

dayjs.extend(weekOfYear);
dayjs.extend(dayOfYear);

const debug = Debug('chums:lib:sales:salesorder:orders-by-period');

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
             LEFT JOIN c2.SY_User uc
                       ON uc.UserKey = hh.UserCreatedKey
             LEFT JOIN c2.SY_User uu
                       ON uu.UserKey = hh.UserUpdatedKey
             LEFT JOIN c2.so_cancelreasoncode s
                       ON s.Company = soh.Company AND s.CancelReasonCode = soh.CancelReasonCode
    WHERE hh.OrderStatus IN ('A', 'C')
      AND hh.Company = 'chums'
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
             INNER JOIN c2.SY_User uc
                        ON uc.UserKey = soh.UserCreatedKey
             LEFT JOIN c2.SY_User uu
                       ON uu.UserKey = soh.UserUpdatedKey
             LEFT JOIN c2.so_cancelreasoncode s
                       ON s.Company = soh.Company AND s.CancelReasonCode = soh.CancelReasonCode
    WHERE soh.OrderType IN ('M')
      AND soh.Company = 'chums'
      AND IF(IFNULL(:dateType, '') = 'od', soh.OrderDate BETWEEN :minDate AND :maxDate,
             soh.ShipExpireDate BETWEEN :minDate AND :maxDate)
      AND (IFNULL(:filterDivision, '') = '' OR soh.ARDivisionNo = :filterDivision)
      AND (IFNULL(:filterRep, '') = '' OR soh.SalespersonNo = :filterRep)
`;


/**
 * Note: this is not filtered by user roles, so data is only for employees
 */
export interface loadOrdersByPeriodProps {
    dateType?: 'od' | 'sd' | string | null;
    minDate: string;
    maxDate: string;
    filterDivision?: string;
    filterRep?: string;
}

async function loadOrdersByPeriod(props: loadOrdersByPeriodProps): Promise<OrdersByPeriodRecord[]> {
    try {
        const data = {
            dateType: props.dateType ?? 'sd',
            minDate: props.minDate,
            maxDate: props.maxDate,
            filterDivision: props.filterDivision ?? null,
            filterRep: props.filterRep ?? null,
        };
        const [rows] = await mysql2Pool.query<(OrdersByPeriodRecord & RowDataPacket)[]>(queryOrders, data);
        return rows.map(row => ({
            ...row,
            OrderTotal: Number(row.OrderTotal),
            week: dayjs(row.OrderDate).week(),
            day: dayjs(row.OrderDate).dayOfYear(),
        }))
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadOrderStatusList()", err.message);
            return Promise.reject(err);
        }
        debug("loadOrderStatusList()", err);
        return Promise.reject(new Error('Error in loadOrderStatusList()'));
    }
}

export async function getOrdersByPeriod(req: Request, res: Response) {
    try {
        const params: loadOrdersByPeriodProps = {
            dateType: req.params.dateType ?? req.query.dateType as string ?? null,
            minDate: req.params.minDate ?? req.query.minDate as string ?? dayjs().startOf('week').format('YYYY-MM-DD'),
            maxDate: req.params.maxDate ?? req.query.maxDate as string ?? dayjs().endOf('week').format('YYYY-MM-DD'),
            filterDivision: req.query.filterDivision as string ?? null,
            filterRep: req.query.filterRep as string ?? null,
        }
        const orders = await loadOrdersByPeriod(params);
        res.json({orders});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getOrderStatusList()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getOrderStatusList'});
    }
}

