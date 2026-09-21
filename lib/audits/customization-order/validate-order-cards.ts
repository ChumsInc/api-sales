import {CardValidation} from "./types.js";
import {mysql2Pool} from "chums-local-modules";
import {RowDataPacket} from "mysql2";
import Debug from "debug";
import {Decimal} from "decimal.js";

const debug = Debug("chums:lib:audits:customization-order:validate-order-cards");

const sql = `
    WITH SalesOrderDetail AS (SELECT sod.SalesOrderNo,
                                     sod.ItemCode,
                                     (sod.QuantityOrdered * sod.UnitOfMeasureConvFactor) AS QuantityOrdered,
                                     i.SalesUnitOfMeasure,
                                     sod.SalesKitLineKey
                              FROM c2.SO_SalesOrderHeader soh
                                       INNER JOIN c2.SO_SalesOrderDetail sod ON soh.SalesOrderNo = sod.SalesOrderNo
                                       INNER JOIN c2.CI_Item i ON sod.ItemCode = i.itemCode
                              WHERE soh.SalesOrderNo = :salesOrderNo)
    -- items ordered should equal tags ordered for 12115
    SELECT 'validate: 12115 cards'                                AS method,
           SUM(IF(d.ItemCode LIKE '12115%IMP' AND d.SalesUnitOfMeasure = 'EA',
                  d.QuantityOrdered,
                  0))                                             AS quantityItemsOrdered,
           SUM(IF(d.ItemCode = '1TG12115', d.QuantityOrdered, 0)) AS quantityTagsOrdered
    FROM SalesOrderDetail d
    WHERE d.SalesKitLineKey IS NULL

    UNION ALL
    -- items ordered should equal tags ordered for 12424
    SELECT 'validate: 12424 cards'                                AS method,
           SUM(IF(d.ItemCode LIKE '12424%IMP' AND d.SalesUnitOfMeasure = 'EA',
                  d.QuantityOrdered,
                  0))                                             AS quantityItemsOrdered,
           SUM(IF(d.ItemCode = '1TG12424', d.QuantityOrdered, 0)) AS quantityTagsOrdered
    FROM SalesOrderDetail d
    WHERE d.SalesKitLineKey IS NULL


    UNION ALL
    -- should equal 0 for other cards
    SELECT 'validate: other cards'       AS method,
           0                             AS quantityItemsOrdered,
           SUM(IF(d.ItemCode LIKE '1TG%' AND d.ItemCode NOT REGEXP '^1TG(12115|12424)' AND d.SalesKitLineKey IS NULL,
                  d.QuantityOrdered, 0)) AS quantityTagsOrdered
    FROM SalesOrderDetail d

`

export async function loadOrderCardValidation(salesOrderNo: string): Promise<CardValidation[]> {
    try {
        const [rows] = await mysql2Pool.query<(CardValidation & RowDataPacket)[]>(sql, {salesOrderNo});
        return rows.filter(row => !(new Decimal(row.quantityItemsOrdered).eq(0) && new Decimal(row.quantityTagsOrdered).eq(0)))
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadOrderCardValidation()", err.message);
            return Promise.reject(err);
        }
        debug("loadOrderCardValidation()", err);
        return Promise.reject(new Error('Error in loadOrderCardValidation()'));
    }
}
