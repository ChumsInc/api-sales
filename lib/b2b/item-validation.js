import { mysql2Pool } from 'chums-local-modules';
import Debug from 'debug';
const debug = Debug('chums:lib:b2b:item-validation');
export async function loadInactiveProducts() {
    try {
        const sql = `SELECT p.products_id as id,
                            p.products_keyword as keyword,
                            p.products_sell_as as sellAs,
                            p.products_model as ItemCode,
                            i.ItemCodeDesc,
                            i.ProductType,
                            i.InactiveItem
                     FROM b2b_oscommerce.products p
                              LEFT JOIN c2.ci_item i ON i.ItemCode = p.products_model AND i.company = 'chums'
                     WHERE p.products_status = 1
                       AND p.products_sell_as IN (1, 3)
                       AND (i.ItemCode is null OR i.ProductType = 'D' OR i.InactiveItem = 'Y')                    
                       
                       UNION
                         SELECT p.products_id,
                                p.products_keyword,
                                p.products_sell_as,
                                pi.itemCode,
                                i.ItemCodeDesc,
                                i.ProductType,
                                i.InactiveItem
                         FROM b2b_oscommerce.products p
                                  INNER JOIN b2b_oscommerce.products_items pi on pi.productsID = p.products_id
                                  left join c2.ci_item i on i.ItemCode = pi.itemCode
                         where p.products_sell_as = 4
                           and p.products_status = 1
                           and pi.active = 1
                           and (i.ItemCode is null OR i.ProductType = 'D' OR i.InactiveItem = 'Y')                        
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
