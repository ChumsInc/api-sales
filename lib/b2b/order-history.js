import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
import dayjs from "dayjs";
const debug = Debug('chums:lib:b2b:order-history');
async function loadOrderHistory(params) {
    try {
        const sql = `SELECT sohh.SalesOrderNo,
                            sohh.OrderStatus,
                            sohh.ARDivisionNo,
                            sohh.CustomerNo,
                            sohh.ShipToCode,
                            sohh.BillToName,
                            sohh.ShipToName,
                            sohh.SalespersonDivisionNo,
                            sohh.SalespersonNo,
                            rep.SalespersonName,
                            sohh.OrderDate,
                            sohh.PromotedDate,
                            sohh.ShipExpireDate,
                            sohh.LastInvoiceDate,
                            (sohh.TaxableAmt + sohh.NonTaxableAmt - sohh.DiscountAmt) AS OrderTotal,
                            b2bh.users,
                            b2bh.userActions
                     FROM c2.SO_SalesOrderHistoryHeader sohh
                              INNER JOIN (SELECT bh.dbCompany     AS Company,
                                                 bh.SalesOrderNo,
                                                 JSON_ARRAYAGG(DISTINCT
                                                               JSON_OBJECT(
                                                                       'userId', UserID,
                                                                       'action', JSON_VALUE(action, '$.action')
                                                               ) ORDER BY bh.original_timestamp
                                                 )                AS userActions,
                                                 JSON_ARRAYAGG(DISTINCT
                                                               JSON_OBJECT(
                                                                       'userId', u.id,
                                                                       'email', u.email,
                                                                       'name', u.name,
                                                                       'company', u.company,
                                                                       'userType', u.accountType
                                                               )) AS users
                                          FROM b2b.SalesOrderHistory bh
                                                   INNER JOIN users.users u ON u.id = bh.UserID
                                          WHERE bh.dbCompany = 'chums'
                                            AND JSON_VALUE(action, '$.action') NOT IN ('cleanup', 'print')
                                            AND (IFNULL(:userId, 0) = 0 OR u.id = :userId)
                                          GROUP BY dbCompany, SalesOrderNo) b2bh
                                         ON b2bh.Company = sohh.Company AND b2bh.SalesOrderNo = sohh.SalesOrderNo
                              LEFT JOIN c2.ar_salesperson rep ON rep.Company = sohh.Company AND
                                                                 rep.SalespersonDivisionNo =
                                                                 sohh.SalespersonDivisionNo AND
                                                                 rep.SalespersonNo = sohh.SalespersonNo
                     WHERE sohh.Company = 'chums'
                       AND sohh.OrderStatus NOT IN ('X', 'Z')
                       AND (IFNULL(:arDivisionNo, '') = '' OR sohh.ARDivisionNo = :arDivisionNo)
                       AND (IFNULL(:customerNo, '') = '' OR sohh.CustomerNo = :customerNo)
                       AND (
                         ((IFNULL(:minDate, '') = '' OR sohh.OrderDate >= :minDate) AND
                          (IFNULL(:maxDate, '') = '' OR sohh.OrderDate <= :maxDate))
                             OR
                         ((IFNULL(:minDate, '') = '' OR sohh.PromotedDate >= :minDate) AND
                          (IFNULL(:maxDate, '') = '' OR sohh.PromotedDate <= :maxDate))
                         )`;
        const [rows] = await mysql2Pool.query(sql, params);
        return rows.map(row => {
            return {
                ...row,
                users: JSON.parse(row.users ?? '[]'),
                userActions: JSON.parse(row.userActions ?? '[]')
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadOrderHistory()", err.message);
            return Promise.reject(err);
        }
        debug("loadOrderHistory()", err);
        return Promise.reject(new Error('Error in loadOrderHistory()'));
    }
}
export const getOrderHistory = async (req, res) => {
    try {
        const minDate = req.query.minDate;
        const maxDate = req.query.maxDate;
        const userId = req.query.userId ?? null;
        const arDivisionNo = req.query.arDivisionNo ?? null;
        const customerNo = req.query.customerNo ?? null;
        const params = {
            minDate: dayjs(minDate).isValid() ? dayjs(minDate).format('YYYY-MM-DD') : null,
            maxDate: dayjs(maxDate).isValid() ? dayjs(maxDate).format('YYYY-MM-DD') : null,
            userId,
            arDivisionNo,
            customerNo,
        };
        const orders = await loadOrderHistory(params);
        res.json({ params, orders });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getOrderHistory()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getOrderHistory' });
    }
};
