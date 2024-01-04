import { mysql2Pool } from 'chums-local-modules';
import Debug from 'debug';
import numeral from "numeral";
const debug = Debug('chums:lib:b2b:item-validation');
export async function loadInactiveProducts() {
    try {
        const sql = `SELECT p.products_id                    AS id,
                            p.products_keyword               AS keyword,
                            p.products_sell_as               AS sellAs,
                            p.products_model                 AS ItemCode,
                            p.products_status                AS status,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem,
                            IFNULL(ia.ItemStatus, '')        AS ItemStatus,
                            IFNULL(vwa.QuantityAvailable, 0) AS QuantityAvailable,
                            i.TotalQuantityOnHand
                     FROM b2b_oscommerce.products p
                              LEFT JOIN c2.ci_item i ON i.ItemCode = p.products_model AND i.company = 'chums'
                              LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                        ON ia.company = i.company AND
                                           ia.ItemCode = i.ItemCode AND
                                           ia.WarehouseCode = '000'
                              LEFT JOIN c2.v_web_available vwa
                                        ON vwa.Company = i.company AND vwa.ItemCode = i.ItemCode AND
                                           vwa.WarehouseCode = '000'
                     WHERE p.products_sell_as = 1
                       AND (
                         (p.products_status = 1 AND (i.ItemCode IS NULL OR
                                                     i.ProductType = 'D' OR
                                                     i.InactiveItem = 'Y' OR
                                                     (ia.ItemStatus LIKE 'D%' AND vwa.QuantityAvailable = 0)
                             )) OR
                         (p.products_status = 0 AND i.ProductType = 'F' AND vwa.QuantityAvailable > 0)
                         )

                     UNION

                     SELECT p.products_id                    AS id,
                            p.products_keyword               AS keyword,
                            p.products_sell_as               AS sellAs,
                            p.products_model                 AS ItemCode,
                            p.products_status                AS status,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem,
                            IFNULL(ia.ItemStatus, '')        AS ItemStatus,
                            IFNULL(vwa.QuantityAvailable, 0) AS QuantityAvailable,
                            i.TotalQuantityOnHand
                     FROM b2b_oscommerce.products p
                              LEFT JOIN c2.ci_item i ON i.ItemCode = p.products_model AND i.company = 'chums'
                              LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                        ON ia.company = i.company AND
                                           ia.ItemCode = i.ItemCode AND
                                           ia.WarehouseCode = '000'
                              LEFT JOIN c2.v_web_available vwa
                                        ON vwa.Company = i.company AND vwa.ItemCode = i.ItemCode AND
                                           vwa.WarehouseCode = '000'
                     WHERE p.products_sell_as = 3
                       AND (
                         (p.products_status = 1 AND (i.ItemCode IS NULL OR
                                                     i.ProductType = 'D' OR
                                                     i.InactiveItem = 'Y')) OR
                         (p.products_status = 0 AND
                          i.ProductType = 'F' AND
                          i.InactiveItem <> 'Y' AND
                          vwa.QuantityAvailable > 0)
                         )

                     UNION

                     SELECT p.products_id,
                            p.products_keyword,
                            p.products_sell_as,
                            pi.itemCode,
                            p.products_status AND pi.active  AS Status,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem,
                            IFNULL(ia.ItemStatus, '')        AS ItemStatus,
                            IFNULL(vwa.QuantityAvailable, 0) AS QuantityAvailable,
                            i.TotalQuantityOnHand
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_items pi ON pi.productsID = p.products_id
                              LEFT JOIN c2.ci_item i ON i.ItemCode = pi.itemCode
                              LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                        ON ia.company = i.company AND
                                           ia.ItemCode = i.ItemCode AND
                                           ia.WarehouseCode = '000'
                              LEFT JOIN c2.v_web_available vwa
                                        ON vwa.Company = i.company AND vwa.ItemCode = i.ItemCode AND
                                           vwa.WarehouseCode = '000'
                     WHERE p.products_sell_as = 4
                       AND p.products_status = 1
                       AND pi.active = 1
                       AND (p.products_status = 1 AND
                            pi.active = 1 AND
                            (
                                (i.ItemCode IS NULL OR
                                 i.ProductType = 'D' OR
                                 i.InactiveItem = 'Y' OR
                                 (ia.ItemStatus LIKE 'D%' AND vwa.QuantityAvailable = 0))) OR
                            ((p.products_status = 0 OR pi.active = 0) AND vwa.QuantityAvailable > 0)
                         )

                     ORDER BY keyword, ItemCode
        `;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadInactiveProducts()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadInactiveProducts()", err);
        return Promise.reject(new Error('Error in loadInactiveProducts()'));
    }
}
export async function loadInactiveProductImages() {
    try {
        const sql = `
            SELECT p.products_id                                                     AS id,
                   p.products_keyword                                                AS keyword,
                   p.products_sell_as                                                AS sellAs,
                   p.products_model                                                  AS ItemCode,
                   p.products_status                                                 AS status,
                   REPLACE(p.products_image, '?', p.products_default_color)          AS productImage,
                   p.products_default_color                                          AS defaultColor,
                   pi.itemCode                                                       AS childItemCode,
                   pi.colorCode                                                      AS childColorCode,
                   IFNULL(pi.active, 0)                                              AS childActive,
                   JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')) AS childImageFilename
            FROM b2b_oscommerce.products p
                     INNER JOIN b2b_oscommerce.products_items pi
                                ON pi.productsID = p.products_id AND
                                   (pi.colorCode = p.products_default_color OR
                                    JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')) =
                                    REPLACE(p.products_image, '?', p.products_default_color))
            WHERE p.products_status = 1
              AND IFNULL(pi.active, 0) = 0

            UNION

            SELECT p.products_id                                                     AS id,
                   p.products_keyword                                                AS keyword,
                   p.products_sell_as                                                AS sellAs,
                   p.products_model                                                  AS ItemCode,
                   p.products_status                                                 AS status,
                   REPLACE(p.products_image, '?', p.products_default_color)          AS productImage,
                   p.products_default_color                                          AS defaultColor,
                   pi.itemCode,
                   pi.colorCode,
                   IFNULL(pi.active, 0)                                              AS childActive,
                   JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')) AS childImageFilename
            FROM b2b_oscommerce.products p
                     LEFT JOIN b2b_oscommerce.products_items pi
                               ON pi.productsID = p.products_id AND
                                  (pi.colorCode = p.products_default_color OR
                                   JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')) =
                                   REPLACE(p.products_image, '?', p.products_default_color))
            WHERE p.products_status = 1
              AND p.products_sell_as = 4
              AND IFNULL(pi.active, 0) = 0

            UNION

            SELECT p.products_id                                            AS id,
                   p.products_keyword                                       AS keyword,
                   p.products_sell_as                                       AS sellAs,
                   p.products_model                                         AS ItemCode,
                   p.products_status                                        AS status,
                   REPLACE(p.products_image, '?', p.products_default_color) AS productImage,
                   p.products_default_color                                 AS defaultColor,
                   NULL                                                     AS childItemCode,
                   NULL                                                     AS childColorCode,
                   IFNULL(i.active, 0)                                      AS childActive,
                   i.filename                                               AS childImageFilename
            FROM b2b_oscommerce.products p
                     LEFT JOIN c2.PM_Images i ON i.filename = REPLACE(p.products_image, '?', p.products_default_color)
            WHERE p.products_status = 1
              AND p.products_sell_as = 4
              AND IFNULL(i.active, 0) = 0`;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadInactiveProductImages()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadInactiveProductImages()", err);
        return Promise.reject(new Error('Error in loadInactiveProductImages()'));
    }
}
export async function loadCategoryProductValidation() {
    try {
        const sql = `SELECT cp.categorypage_id AS id,
                            cp.page_keyword    AS pageKeyword,
                            cpi.item_title     AS itemTitle,
                            p.products_keyword AS productKeyword,
                            p.products_status  AS productStatus,
                            p.products_sell_as AS sellAs,
                            p.products_model   AS itemCode
                     FROM b2b_oscommerce.category_pages cp
                              INNER JOIN b2b_oscommerce.category_pages_items cpi
                                         ON cpi.categorypage_id = cp.categorypage_id
                              INNER JOIN b2b_oscommerce.products p ON cpi.products_id = p.products_id
                     WHERE cp.status = 1
                       AND cpi.status = 1
                       AND p.products_status = 0
                     ORDER BY page_keyword, products_keyword
        `;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadCategoryProductValidation()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadCategoryProductValidation()", err);
        return Promise.reject(new Error('Error in loadCategoryProductValidation()'));
    }
}
export async function loadProductCategoryValidation() {
    try {
        const sql = `SELECT p.products_id                AS id,
                            p.products_keyword           AS keyword,
                            p.products_model             AS ItemCode,
                            p.products_sell_as           AS sellAs,
                            p.default_parent_products_id AS parentId,
                            cp.categorypage_id           AS categoryPageId,
                            cp.page_keyword              AS pageKeyword,
                            cp.status                    AS pageStatus,
                            cpi.status                   AS pageItemStatus
                     FROM b2b_oscommerce.products p
                              LEFT JOIN b2b_oscommerce.category_pages_items cpi
                                        ON cpi.products_id = p.products_id AND
                                           cpi.categorypage_id = p.default_categories_id
                              LEFT JOIN b2b_oscommerce.category_pages cp ON cp.categorypage_id = cpi.categorypage_id
                     WHERE p.products_status = 1
                       AND (p.default_categories_id = 0 OR cp.status = 0 OR cpi.status = 0)

                     UNION

                     SELECT p.products_id,
                            p.products_keyword,
                            p.products_model AS ItemCode,
                            p.products_sell_as,
                            p.default_parent_products_id,
                            cp.categorypage_id,
                            cp.page_keyword,
                            cp.status        AS pageStatus,
                            NULL             AS pageItemStatus
                     FROM b2b_oscommerce.products p
                              LEFT JOIN b2b_oscommerce.category_pages cp ON cp.categorypage_id = p.default_categories_id
                     WHERE p.products_status = 1
                       AND (p.default_categories_id = 0 OR cp.status = 0)

                     ORDER BY keyword, pageKeyword`;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            console.debug("loadProductCategoryValidation()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadProductCategoryValidation()", err);
        return Promise.reject(new Error('Error in loadProductCategoryValidation()'));
    }
}
export async function getItemValidation(req, res) {
    try {
        const items = await loadInactiveProducts();
        const images = await loadInactiveProductImages();
        const pages = await loadCategoryProductValidation();
        const productCategories = await loadProductCategoryValidation();
        res.json({ items, images, pages, productCategories });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getItemValidation()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getItemValidation' });
    }
}
export async function renderItemValidation(req, res) {
    try {
        const items = await loadInactiveProducts();
        const images = await loadInactiveProductImages();
        const pages = await loadCategoryProductValidation();
        const productCategories = await loadProductCategoryValidation();
        if (!items.length && !images.length && !pages.length && !productCategories.length) {
            res.status(304).send();
            return;
        }
        res.render('sales/b2b-item-validation.pug', {
            items: items.map(i => ({
                ...i,
                QuantityAvailable: numeral(i.QuantityAvailable).format('0,0')
            })),
            images,
            pages,
            productCategories,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderItemValidation()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in renderItemValidation' });
    }
}
