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
                       AND p.products_status = 1
                       AND JSON_EXTRACT(p.additional_data, '$.isRedirect') <> true
                       AND (i.ItemCode IS NULL OR
                            i.ProductType = 'D' OR
                            i.InactiveItem = 'Y' OR
                            (ia.ItemStatus LIKE 'D%' AND vwa.QuantityAvailable = 0)
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
                       AND p.products_status = 1
                       AND (i.ItemCode IS NULL OR
                            i.ProductType = 'D' OR
                            i.InactiveItem = 'Y' OR
                            (ia.ItemStatus LIKE 'D%' AND vwa.QuantityAvailable = 0)
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
                       AND p.products_status = 1
                       AND (i.ItemCode IS NULL OR
                            i.ProductType = 'D' OR
                            i.InactiveItem = 'Y' OR
                            (ia.ItemStatus LIKE 'D%' AND vwa.QuantityAvailable = 0)
                         )

                     ORDER BY keyword, ItemCode
        `;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInactiveProducts()", err.message);
            return Promise.reject(err);
        }
        debug("loadInactiveProducts()", err);
        return Promise.reject(new Error('Error in loadInactiveProducts()'));
    }
}
export async function loadInactiveProductImages(includePreferredImages = false) {
    const preferredImages = includePreferredImages ? 1 : 0;
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
                   NULL                                                              AS preferredImage,
                   JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')) AS childImageFilename
            FROM b2b_oscommerce.products p
                     INNER JOIN b2b_oscommerce.products_items pi
                                ON pi.productsID = p.products_id AND
                                   (pi.colorCode = p.products_default_color OR
                                    JSON_VALUE(pi.additionalData, '$.image_filename') =
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
                   NULL                                                              AS preferredImage,
                   JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')) AS childImageFilename
            FROM b2b_oscommerce.products p
                     LEFT JOIN b2b_oscommerce.products_items pi
                               ON pi.productsID = p.products_id AND
                                  (pi.colorCode = p.products_default_color OR
                                   JSON_VALUE(pi.additionalData, '$.image_filename') =
                                   REPLACE(p.products_image, '?', p.products_default_color))
            WHERE p.products_status = 1
              AND p.products_sell_as = 4
              AND IFNULL(pi.active, 0) = 0

            UNION

            SELECT p.products_id                                                    AS id,
                   p.products_keyword                                               AS keyword,
                   p.products_sell_as                                               AS sellAs,
                   p.products_model                                                 AS ItemCode,
                   p.products_status                                                AS status,
                   IFNULL(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pi.additionalData, '$.image_filename')), ''),
                          REPLACE(p.products_image, '?', p.products_default_color)) AS productImage,
                   p.products_default_color                                         AS defaultColor,
                   pi.itemCode                                                      AS childItemCode,
                   pi.colorCode                                                     AS childColorCode,
                   IFNULL(i.active, '')                                             AS childActive,
                   IFNULL(i.preferred_image, 0)                                     AS preferredImage,
                   NULL                                                             AS childImageFilename
            FROM b2b_oscommerce.products p
                     LEFT JOIN b2b_oscommerce.products_items pi
                               ON pi.productsID = p.products_id AND
                                  pi.colorCode = p.products_default_color
                     LEFT JOIN c2.PM_Images i
                               ON i.filename =
                                  IFNULL(NULLIF(JSON_VALUE(pi.additionalData, '$.image_filename'), ''),
                                         REPLACE(p.products_image, '?', p.products_default_color))
            WHERE p.products_status = 1
              AND p.products_sell_as = 4
              AND (IFNULL(i.active, 0) = 0 OR IFNULL(i.preferred_image, 0) = 0)
              AND (IFNULL(${preferredImages}, 0) = 1)

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
                   NULL                                                     AS childActive,
                   IFNULL(i.preferred_image, 0)                             AS preferredImage,
                   NULL                                                     AS childImageFilename
            FROM b2b_oscommerce.products p
                     LEFT JOIN c2.PM_Images i
                               ON i.filename = REPLACE(p.products_image, '?', p.products_default_color)
            WHERE p.products_status = 1
              AND (IFNULL(i.active, 0) = 0 OR IFNULL(i.preferred_image, 0) = 0)
              AND (IFNULL(${preferredImages}, 0) = 1)

            ORDER BY keyword, ItemCode
        `;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInactiveProductImages()", err.message);
            return Promise.reject(err);
        }
        debug("loadInactiveProductImages()", err);
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
            debug("loadCategoryProductValidation()", err.message);
            return Promise.reject(err);
        }
        debug("loadCategoryProductValidation()", err);
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
            debug("loadProductCategoryValidation()", err.message);
            return Promise.reject(err);
        }
        debug("loadProductCategoryValidation()", err);
        return Promise.reject(new Error('Error in loadProductCategoryValidation()'));
    }
}
export async function loadBillDetailValidation() {
    try {
        const sql = `SELECT p.products_id      AS productId,
                            p.products_model   AS ItemCode,
                            p.products_keyword AS keyword,
                            pd.products_name   AS name,
                            m.mixID,
                            bh.BillNo          AS MixItemCode,
                            NULL               AS ComponentItemCode,
                            NULL               AS BillComponentItemCode,
                            NULL               AS itemQuantity,
                            NULL               AS QuantityPerBill,
                            NULL               AS color_code,
                            NULL               AS color_name
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_description pd ON pd.products_id = p.products_id
                              INNER JOIN b2b_oscommerce.products_mixes m ON m.productsID = p.products_id
                              LEFT JOIN c2.BM_BillHeader bh ON bh.Company = 'chums' AND bh.BillNo = m.itemCode
                     WHERE p.products_status = 1
                       AND (p.products_model <> m.itemCode OR p.products_sell_as <> 3 OR
                            m.active <> p.products_status OR bh.BillNo IS NULL)

                     UNION

                     SELECT p.products_id,
                            p.products_model,
                            p.products_keyword,
                            pd.products_name,
                            m.mixID,
                            bh.BillNo,
                            md.itemCode,
                            bd.ComponentItemCode,
                            md.itemQuantity,
                            ROUND(bd.QuantityPerBill * i.SalesUMConvFctr, 1) AS QuantityPerBill,
                            c.color_code,
                            color_name
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_description pd ON pd.products_id = p.products_id

                              INNER JOIN b2b_oscommerce.products_mixes m ON m.productsID = p.products_id
                              INNER JOIN b2b_oscommerce.products_mixes_detail md ON m.mixID = md.mixID
                              LEFT JOIN b2b_oscommerce.colors c ON c.colors_id = md.colorsID
                              LEFT JOIN c2.ci_item i ON i.company = 'chums' AND i.ItemCode = m.itemCode
                              LEFT JOIN c2.BM_BillHeader bh ON bh.Company = i.company AND bh.BillNo = i.itemCode
                              LEFT JOIN c2.BM_BillDetail bd
                                        ON bd.Company = bh.Company AND
                                           bd.BillNo = bh.BillNo AND
                                           bd.ComponentItemCode = md.itemCode
                     WHERE p.products_status = 1
                       AND IFNULL(md.itemCode, '') <> IFNULL(bd.ComponentItemCode, '')


                     UNION

                     SELECT p.products_id,
                            p.products_model,
                            p.products_keyword,
                            pd.products_name,
                            m.mixID,
                            bh.BillNo,
                            md.itemCode,
                            bd.ComponentItemCode,
                            md.itemQuantity,
                            ROUND(bd.QuantityPerBill * i.SalesUMConvFctr, 1) AS QuantityPerBill,
                            c.color_code,
                            color_name
                     FROM b2b_oscommerce.products p
                              INNER JOIN b2b_oscommerce.products_description pd ON pd.products_id = p.products_id
                              INNER JOIN b2b_oscommerce.products_mixes m ON m.productsID = p.products_id
                              INNER JOIN b2b_oscommerce.products_mixes_detail md ON m.mixID = md.mixID
                              LEFT JOIN b2b_oscommerce.colors c ON c.colors_id = md.colorsID
                              LEFT JOIN c2.ci_item i ON i.company = 'chums' AND i.ItemCode = m.itemCode
                              LEFT JOIN c2.BM_BillHeader bh ON bh.Company = i.company AND bh.BillNo = i.itemCode
                              LEFT JOIN c2.BM_BillDetail bd
                                        ON bd.Company = bh.Company AND bd.BillNo = bh.BillNo AND
                                           bd.ComponentItemCode = md.itemCode
                     WHERE p.products_status = 1
                       AND md.itemQuantity <> ROUND(bd.QuantityPerBill * i.SalesUMConvFctr, 1)

                     ORDER BY ItemCode, componentItemCode`;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadBillDetailValidation()", err.message);
            return Promise.reject(err);
        }
        debug("loadBillDetailValidation()", err);
        return Promise.reject(new Error('Error in loadBillDetailValidation()'));
    }
}
export async function getItemValidation(req, res) {
    try {
        const items = await loadInactiveProducts();
        const images = await loadInactiveProductImages(req.query.preferredImage === '1');
        const pages = await loadCategoryProductValidation();
        const productCategories = await loadProductCategoryValidation();
        const mixes = await loadBillDetailValidation();
        res.json({ items, images, pages, productCategories, mixes });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getItemValidation()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getItemValidation' });
    }
}
export async function renderItemValidation(req, res) {
    try {
        const items = await loadInactiveProducts();
        const images = await loadInactiveProductImages(req.query.preferredImage === '1');
        const pages = await loadCategoryProductValidation();
        const productCategories = await loadProductCategoryValidation();
        const mixes = []; //await loadBillDetailValidation();
        const errors = items.length + images.length + pages.length + productCategories.length + mixes.length;
        if (!errors) {
            res.status(204).send();
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
            mixes,
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderItemValidation()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in renderItemValidation' });
    }
}
