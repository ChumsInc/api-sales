import { mysql2Pool } from "chums-local-modules";
import Debug from "debug";
const debug = Debug("chums:lib:audits:customization-order:validate-moq");
const sql = `
    WITH CustomizationCodes AS (SELECT cc.section,
                                       cc.customizationCode,
                                       SUM(sod.QuantityOrdered) AS quantityOrdered
                                FROM c2.SO_SalesOrderHeader soh
                                         INNER JOIN c2.SO_SalesOrderDetail sod ON soh.SalesOrderNo = sod.SalesOrderNo
                                         INNER JOIN c2.IM_CustomizationCode cc ON sod.ItemCode = cc.customizationCode
                                WHERE soh.SalesOrderNo = :salesOrderNo
                                GROUP BY cc.section, cc.CustomizationCode)
       , CustomizationSKUs AS (SELECT cc.section, cc.customizationCode, sku.sku, sku.options, sku.category
                               FROM CustomizationCodes cc
                                        INNER JOIN IM_CustomizationSKU sku ON cc.section = sku.section)
       , CustomizationItems AS (SELECT sku.section,
                                       sku.customizationCode,
                                       sku.sku,
                                       SUM(sod.QuantityOrdered * sod.UnitOfMeasureConvFactor)   AS itemsOrdered,
                                       JSON_ARRAYAGG(DISTINCT sku.sku ORDER BY sku.sku)         AS skuList,
                                       JSON_ARRAYAGG(
                                               JSON_OBJECT('ItemCode', sod.ItemCode,
                                                           'sku', cim.sku,
                                                           'QuantityOrdered',
                                                           sod.QuantityOrdered * sod.UnitOfMeasureConvFactor
                                               )
                                               ORDER BY sod.ItemCode)                           AS itemList,
                                       JSON_ARRAYAGG(DISTINCT sod.LineKey ORDER BY sod.LineKey) AS lineKeyList
                                FROM CustomizationSKUs sku
                                         INNER JOIN c2.IM_CustomizationItemMatch cim
                                                    ON sku.SKU = cim.SKU AND
                                                       sku.section = cim.section AND
                                                       sku.customizationCode = cim.customizationCode
                                         INNER JOIN SO_SalesOrderDetail sod ON cim.itemCode = sod.ItemCode
                                WHERE sod.SalesOrderNo = :salesOrderNo
#                                   AND sod.ExplodedKitItem <> 'Y'
                                GROUP BY sku.section, sku.customizationCode, sku.sku)
    SELECT ci.section,
           sku.category                                                               AS category,
           JSON_ARRAYAGG(DISTINCT ci.sku)                                             AS sku,
           MAX(IFNULL(JSON_VALUE(sku.options, '$.moq'), 0))                           AS moq,
           JSON_ARRAYAGG(customizationCode)                                           AS customizationCodes,
           SUM(itemsOrdered)                                                          AS quantityOrdered,
           JSON_ARRAYAGG(JSON_OBJECT('sku', ci.sku, 'quantityOrdered', itemsOrdered)) AS skuList
    FROM CustomizationItems ci
             INNER JOIN IM_CustomizationSKU sku ON ci.section = sku.section AND ci.sku = sku.sku
    WHERE ci.section = 'screen-print'
    GROUP BY ci.section, sku.category

    UNION

    SELECT ci.section,
           NULL                                                                       AS category,
           JSON_ARRAYAGG(DISTINCT ci.sku)                                             AS sku,
           200                                                                        AS moq,
           JSON_ARRAY('/INK')                                                         AS customizationCodes,
           SUM(itemsOrdered)                                                          AS quantityOrdered,
           JSON_ARRAYAGG(JSON_OBJECT('sku', ci.sku, 'quantityOrdered', itemsOrdered)) AS skuList
    FROM CustomizationItems ci
    WHERE ci.section = 'screen-print'
      AND EXISTS(SELECT 1 FROM CustomizationCodes WHERE ci.section = 'screen-print' AND ci.customizationCode = '/INK')
    GROUP BY ci.section

    UNION

    SELECT ci.section,
           sku.category,
           JSON_ARRAY(ci.sku)                                                         AS sku,
           JSON_VALUE(sku.options, '$.moq')                                           AS moq,
           JSON_ARRAYAGG(DISTINCT customizationCode)                                  AS customizationCodes,
           SUM(itemsOrdered)                                                          AS quantityOrdered,
           JSON_ARRAYAGG(JSON_OBJECT('sku', ci.sku, 'quantityOrdered', itemsOrdered)) AS skuList
    FROM CustomizationItems ci
             INNER JOIN IM_CustomizationSKU sku ON ci.section = sku.section AND ci.sku = sku.sku
    WHERE sku.section <> 'screen-print'
    GROUP BY ci.section, sku.category, sku.sku, sku.options
`;
export async function loadMOQValidation(salesOrderNo) {
    try {
        const [rows] = await mysql2Pool.query(sql, { salesOrderNo });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadMOQValidation()", err.message);
            return Promise.reject(err);
        }
        debug("loadMOQValidation()", err);
        return Promise.reject(new Error('Error in loadMOQValidation()'));
    }
}
