import { mysql2Pool } from "chums-local-modules";
import Debug from 'debug';
const debug = Debug('chums:lib:audits:customization-order:order-customization-codes');
const sql = `
    WITH CustomizationCodes AS (SELECT soh.SalesOrderNo,
                                       cc.customizationCode,
                                       cc.section,
                                       SUM(sod.QuantityOrdered)              AS quantityOrdered,
                                       JSON_ARRAYAGG(JSON_OBJECT(
                                                             'itemCode', sod.ItemCode,
                                                             'itemCodeDesc', sod.ItemCodeDesc,
                                                             'quantityOrdered', sod.QuantityOrdered,
                                                             'comment', sod.CommentText
                                                     )
                                                     ORDER BY sod.LineSeqNo) AS customizationList
                                FROM c2.SO_SalesOrderHeader soh
                                         INNER JOIN c2.SO_SalesOrderDetail sod ON soh.SalesOrderNo = sod.SalesOrderNo
                                         INNER JOIN c2.IM_CustomizationCode cc ON sod.ItemCode = cc.customizationCode
                                WHERE soh.SalesOrderNo = :salesOrderNo
                                GROUP BY cc.CustomizationCode, cc.section)
       , CustomizationSKUs AS (SELECT cc.customizationCode, cc.section, sku.sku
                               FROM CustomizationCodes cc
                                        INNER JOIN IM_CustomizationSKU sku ON cc.section = sku.section)
       , CustomizationItems AS (SELECT sku.section,
                                       sku.customizationCode,
                                       SUM(sod.QuantityOrdered * sod.UnitOfMeasureConvFactor)   AS itemsOrdered,
                                       JSON_ARRAYAGG(DISTINCT sku.sku ORDER BY sku.sku)         AS skuList,
                                       JSON_ARRAYAGG(
                                               JSON_OBJECT('itemCode', sod.ItemCode,
                                                           'sku', cim.sku,
                                                           'itemCodeDesc', sod.ItemCodeDesc,
                                                           'quantityOrdered',
                                                           sod.QuantityOrdered * sod.UnitOfMeasureConvFactor,
                                                           'comment', sod.CommentText
                                               )
                                               ORDER BY sod.LineSeqNo)                          AS itemList,
                                       JSON_ARRAYAGG(DISTINCT sod.LineKey ORDER BY sod.LineKey) AS lineKeyList
                                FROM CustomizationSKUs sku
                                         INNER JOIN c2.IM_CustomizationItemMatch cim
                                                    ON sku.SKU = cim.SKU AND
                                                       sku.section = cim.section AND
                                                       sku.customizationCode = cim.customizationCode
                                         INNER JOIN SO_SalesOrderDetail sod ON cim.itemCode = sod.ItemCode
                                WHERE sod.SalesOrderNo = :salesOrderNo
#                                   AND sod.ExplodedKitItem <> 'Y'
                                GROUP BY sku.section, sku.customizationCode)
       , UncustomizedIems AS (SELECT 'N/A'                                                    AS section,
                                     i.Category4                                              AS customizationCode,
                                     SUM(sod.QuantityOrdered * sod.UnitOfMeasureConvFactor)   AS itemsOrdered,
                                     JSON_ARRAYAGG(DISTINCT i.Category4 ORDER BY Category4)   AS skuList,
                                     JSON_ARRAYAGG(
                                             JSON_OBJECT('itemCode', sod.ItemCode,
                                                         'sku', i.Category4,
                                                         'itemCodeDesc', sod.ItemCodeDesc,
                                                         'quantityOrdered',
                                                         sod.QuantityOrdered * sod.UnitOfMeasureConvFactor,
                                                         'comment', sod.CommentText
                                             )
                                             ORDER BY sod.LineSeqNo)                          AS itemList,
                                     JSON_ARRAYAGG(DISTINCT sod.LineKey ORDER BY sod.LineKey) AS lineKeyList
                              FROM SO_SalesOrderDetail sod
                                       INNER JOIN c2.CI_Item i ON sod.ItemCode = i.ItemCode
                              WHERE sod.SalesOrderNo = :salesOrderNo
                                AND NOT EXISTS(SELECT 1
                                               FROM CustomizationSKUs sku
                                                        INNER JOIN c2.IM_CustomizationItemMatch cim ON sku.sku = cim.sku
                                               WHERE cim.ItemCode = sod.ItemCode)
                                AND i.ProductType = 'F'
                              GROUP BY i.Category4)
    SELECT cc.section,
           cc.customizationCode,
           cc.quantityOrdered,
           cc.customizationList,
           ci.itemsOrdered,
           ci.skuList,
           ci.itemList,
           ci.lineKeyList
    FROM CustomizationCodes cc
             LEFT JOIN CustomizationItems ci ON cc.section = ci.section AND cc.customizationCode = ci.customizationCode

    UNION

    SELECT ci.section           AS section,
           ci.customizationCode AS customizationCode,
           0                    AS quantityOrdered,
           JSON_ARRAY()         AS customizationList,
           ci.itemsOrdered,
           ci.skuList,
           ci.itemList,
           ci.lineKeyList
    FROM UncustomizedIems ci

`;
export async function loadOrderCustomizationCodes(salesOrderNo) {
    try {
        const [rows] = await mysql2Pool.query(sql, { salesOrderNo });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadOrderCustomizationCodes()", err.message);
            return Promise.reject(err);
        }
        debug("loadOrderCustomizationCodes()", err);
        return Promise.reject(new Error('Error in loadOrderCustomizationCodes()'));
    }
}
