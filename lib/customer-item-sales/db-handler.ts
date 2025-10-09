import {mysql2Pool} from "chums-local-modules";
import Decimal from "decimal.js";
import Debug from "debug";
import type {CustomerItemSalesRecord, CustomerItemSalesRow} from "./customer-item-types.js";
import {RowDataPacket} from "mysql2";


const debug = Debug('chums:lib:customer-item-sales:db-handler');


export interface LoadCustomerItemSalesProps {
    ARDivisionNo?: string|null;
    CustomerNo?: string|null;
    ShipToCode?: string|null;
    ItemCode?: string|null;
    FiscalCalYear: string[];
    groupShipTo?: boolean;
    userId: number;
}

function dataKey({ARDivisionNo, CustomerNo, ShipToCode, ItemCode, FiscalCalYear}:CustomerItemSalesRow):string {
    return [ARDivisionNo, CustomerNo, ShipToCode, ItemCode, FiscalCalYear].join('-');
}

interface DataRow extends RowDataPacket, CustomerItemSalesRow {
    _ShipToCode: string;
}
export async function loadCustomerItemSalesV2({ARDivisionNo, CustomerNo, ItemCode, FiscalCalYear, groupShipTo, userId}:LoadCustomerItemSalesProps):Promise<CustomerItemSalesRecord[]> {
    try {
        const sql = `
            SELECT h.ARDivisionNo,
                   h.CustomerNo,
                   c.CustomerName,
                   IF(IFNULL(:groupShipTo, '') = '0', h.ShipToCode, '') AS _ShipToCode,
                   IF(IFNULL(:groupShipTo, '') = '0', s.ShipToName, '') AS ShipToName,
                   h.ItemCode,
                   i.ItemCodeDesc,
                   h.FiscalCalYear,
                   h.FiscalCalPeriod,
                   SUM(h.QuantitySold)                                  AS QuantitySold,
                   SUM(h.DollarsSold)                                   AS DollarsSold
            FROM c2.IM_ItemCustomerHistoryByPeriod h
                     INNER JOIN c2.ar_customer c
                                ON c.ARDivisionNo = h.ARDivisionNo
                                    AND c.CustomerNo = h.CustomerNo
                                    AND c.Company = h.Company
                     INNER JOIN (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                                 FROM users.user_AR_Customer
                                 WHERE userid = :userId) ua
                                ON ua.Company = c.Company AND ua.ARDivisionNo = c.ARDivisionNo AND
                                   ua.CustomerNo = c.CustomerNo
                     INNER JOIN c2.ci_item i
                                ON i.Company = h.Company AND i.ItemCode = h.ItemCode
                     LEFT JOIN c2.SO_ShipToAddress s
                               ON s.Company = h.Company
                                   AND s.ARDivisionNo = h.ARDivisionNo
                                   AND s.CustomerNo = h.CustomerNo
                                   AND s.ShipToCode = h.ShipToCode
            WHERE h.Company = 'chums'
              AND (IFNULL(:ARDivisionNo, '') = '' OR h.ARDivisionNo = :ARDivisionNo)
              AND (IFNULL(:CustomerNo, '') = '' OR h.CustomerNo = :CustomerNo)
              AND (IFNULL(:ItemCode, '') = '' OR h.ItemCode REGEXP :ItemCode)
              AND h.FiscalCalYear IN (:FiscalCalYear)
            GROUP BY ARDivisionNo,
                     CustomerNo,
                     h.ItemCode,
                     _ShipToCode,
                     FiscalCalYear,
                     FiscalCalPeriod
            ORDER BY ARDivisionNo, CustomerNo, _ShipToCode, ItemCode, FiscalCalYear, FiscalCalPeriod`;
        const args = {
            ARDivisionNo: ARDivisionNo ?? null,
            CustomerNo: CustomerNo ?? null,
            ItemCode: ItemCode ?? null,
            FiscalCalYear: FiscalCalYear,
            groupShipTo: groupShipTo ? '1' : '0',
            userId: userId
        };
        const [rows] = await mysql2Pool.query<DataRow[]>(sql, args);
        const data: Record<string, CustomerItemSalesRecord> = {};
        rows.forEach(row => {
            row.ShipToCode = row._ShipToCode;
            const key = dataKey(row);
            if (key === '') {
                return;
            }
            if (!data[key]) {
                const {FiscalCalPeriod, _ShipToCode, ...rest} = row;
                data[key] = {...rest, ShipToCode: row._ShipToCode, DollarsSold: 0, QuantitySold: 0, periods: {}};
            }
            const dollarsSold = new Decimal(row.DollarsSold);
            const quantitySold = new Decimal(row.QuantitySold);

            data[key].periods[row.FiscalCalPeriod] = {QuantitySold: quantitySold.toNumber(), DollarsSold: dollarsSold.toNumber()};

            data[key].DollarsSold = new Decimal(data[key].DollarsSold).add(dollarsSold).toNumber();
            data[key].QuantitySold = new Decimal(data[key].QuantitySold).add(quantitySold).toNumber();
        });

        return Object.values(data);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadCustomerItemSales()", err.message);
            return Promise.reject(err);
        }
        debug("loadCustomerItemSales()", err);
        return Promise.reject(new Error('Error in loadCustomerItemSales()'));
    }
}
