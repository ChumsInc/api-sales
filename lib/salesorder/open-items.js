/**
 * Created by steve on 5/10/2016.
 */

const debug = require('debug')('chums:lib:salesorder:open-items');
const {mysql2Pool} = require('chums-local-modules');

/**
 *
 * @param {object} params
 * @param {string} params.company
 * @param {string} params.ARDivisionNo
 * @param {string} params.CustomerNo
 * @param {number} params.user_id
 * @return Promise<*>
 */
async function loadOpenItems(params) {
    try {
        const query = `SELECT d.WarehouseCode,
                              d.ItemCode,
                              i.ItemCodeDesc,
                              d.UnitOfMeasure,
                              count(DISTINCT h.SalesOrderNo) AS NumberSalesOrders,
                              sum(d.QuantityOrdered)         AS QuantityOrdered,
                              sum(d.QuantityShipped)         AS QuantityShipped,
                              sum(d.QuantityBackordered)     AS QuantityBackordered,
                              sum(d.QuantityOrdered * d.UnitPrice / d.UnitOfMeasureConvFactor)
                                  / sum(d.QuantityOrdered)   AS UnitPrice,
                              d.UnitOfMeasureConvFactor,
                              sum(d.ExtensionAmt)            AS ExtensionAmt,
                              i.SuggestedRetailPrice,
                              ifnull(b.UPC, i.UDF_UPC)       AS UPC
                       FROM c2.SO_SalesOrderHeader h
                            INNER JOIN c2.SO_SalesOrderDetail d
                                       USING (Company, SalesOrderNo)
                            INNER JOIN c2.ci_item i
                                       USING (Company, ItemCode)
                            INNER JOIN (
                                       SELECT DISTINCT Company, ARDivisionNo, CustomerNo, '' AS ShipToCode
                                       FROM users.user_AR_Customer
                                       WHERE Company = :Company
                                         AND ARDivisionNo = :ARDivisionNo
                                         AND CustomerNo = :CustomerNo
                                         AND userid = :user_id
                                       UNION
                                       SELECT Company, ARDivisionNo, CustomerNo, ShipToCode
                                       FROM users.user_SO_ShipToAddress
                                       WHERE Company = :Company
                                         AND ARDivisionNo = :ARDivisionNo
                                         AND CustomerNo = :CustomerNo
                                         AND userid = :user_id
                                       ) accounts
                                       ON accounts.Company = h.Company
                                           AND accounts.ARDivisionNo = h.ARDivisionNo
                                           AND accounts.CustomerNo = h.CustomerNo
                                           AND accounts.ShipToCode = IFNULL(h.ShipToCode, '')
                            LEFT JOIN  (
                                       SELECT bc.Company,
                                              bc.ARDivisionNo,
                                              bc.CustomerNo,
                                              bd.ItemNumber AS ItemCode,
                                              bd.UPC
                                       FROM barcodes.bc_customer bc
                                            INNER JOIN barcodes.bc_customerdetail bd
                                                       ON bd.CustomerID = bc.id
                                       ) b
                                       ON b.Company = h.Company AND b.ARDivisionNo = h.ARDivisionNo AND
                                          b.CustomerNo = h.CustomerNo AND b.ItemCode = d.ItemCode
                       WHERE h.OrderType NOT IN ('Q', 'M')
                         AND d.ItemType <> '4'
                       GROUP BY d.WarehouseCode, d.ItemCode, d.UnitOfMeasure`;
        const args = {
            user_id: params.user_id,
            Company: params.company,
            ARDivisionNo: params.ARDivisionNo,
            CustomerNo: params.CustomerNo
        };
        debug('loadOpenItems()',args);
        const [rows] = await mysql2Pool.query(query, args);
        rows.forEach(row => {
            row.QuantityBackordered = Number(row.QuantityBackordered);
            row.QuantityOrdered = Number(row.QuantityOrdered);
            row.QuantityShipped = Number(row.QuantityShipped);
            row.UnitPrice = Number(row.UnitPrice);
            row.ExtensionAmt = Number(row.ExtensionAmt);
        })
        return rows;
    } catch (err) {
        debug("loadOpenItems()", err.message);
        return err;
    }
}

async function getOpenItems(req, res) {
    try {
        const params = {
            ...req.params,
            user_id: res.locals.profile.user.id,
        }
        const result = await loadOpenItems(params);
        res.json({result});
    } catch (err) {
        debug("getOpenItems()", err.message);
        res.json({error: err.message});
    }
}

exports.getOpenItems = getOpenItems;
exports.loadOpenItems = loadOpenItems;
