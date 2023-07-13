import { mysql2Pool } from 'chums-local-modules';
import Debug from 'debug';
const debug = Debug('chums:lib:b2b:item-validation');
export async function loadInactiveProducts() {
    try {
        const sql = `SELECT p.products_id      AS id,
                            p.products_keyword AS keyword,
                            p.products_sell_as AS sellAs,
                            p.products_model   AS ItemCode,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem,
                            ifnull(ia.ItemStatus, '') as ItemStatus,
                            ifnull(vwa.QuantityAvailable, 0) as QuantityAvailable
                     FROM b2b_oscommerce.products p
                              LEFT JOIN c2.ci_item i ON i.ItemCode = p.products_model AND i.company = 'chums'
                              LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                        ON ia.company = i.company AND
                                           ia.ItemCode = i.ItemCode AND
                                           ia.WarehouseCode = '000'
                              LEFT JOIN c2.v_web_available vwa
                                        ON vwa.Company = i.company AND vwa.ItemCode = i.ItemCode AND
                                           vwa.WarehouseCode = '000'
                     WHERE p.products_status = 1
                       AND p.products_sell_as = 1
                       AND (i.ItemCode IS NULL OR i.ProductType = 'D' OR i.InactiveItem = 'Y' OR (ia.ItemStatus like 'D%' and vwa.QuantityAvailable = 0))
                    
                     UNION

                     SELECT p.products_id      AS id,
                            p.products_keyword AS keyword,
                            p.products_sell_as AS sellAs,
                            p.products_model   AS ItemCode,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem,
                            ifnull(ia.ItemStatus, '') as ItemStatus,
                            ifnull(vwa.QuantityAvailable, 0) as QuantityAvailable
                     FROM b2b_oscommerce.products p
                              LEFT JOIN c2.ci_item i ON i.ItemCode = p.products_model AND i.company = 'chums'
                              LEFT JOIN c2.IM_ItemWarehouseAdditional ia
                                        ON ia.company = i.company AND
                                           ia.ItemCode = i.ItemCode AND
                                           ia.WarehouseCode = '000'
                              LEFT JOIN c2.v_web_available vwa
                                        ON vwa.Company = i.company AND vwa.ItemCode = i.ItemCode AND
                                           vwa.WarehouseCode = '000'
                     WHERE p.products_status = 1
                       AND p.products_sell_as = 3
                       AND (i.ItemCode IS NULL OR i.ProductType = 'D' OR i.InactiveItem = 'Y')

                     UNION
                     
                     SELECT p.products_id,
                            p.products_keyword,
                            p.products_sell_as,
                            pi.itemCode,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem,
                            ifnull(ia.ItemStatus, '') as ItemStatus,
                            ifnull(vwa.QuantityAvailable, 0) as QuantityAvailable
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
                       AND (i.ItemCode IS NULL OR i.ProductType = 'D' OR i.InactiveItem = 'Y' OR
                            (ia.ItemStatus like 'D%' and vwa.QuantityAvailable = 0))

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
export async function getItemValidation(req, res) {
    try {
        const items = await loadInactiveProducts();
        res.json({ items });
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
        if (!items.length) {
            res.status(304).send();
            return;
        }
        res.render('sales/b2b-item-validation.pug', { items });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderItemValidation()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in renderItemValidation' });
    }
}
