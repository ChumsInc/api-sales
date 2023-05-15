import {mysql2Pool, validateUser} from 'chums-local-modules'
import Debug from "debug";
import {getUserValidation} from "chums-local-modules";
const debug = Debug('chums:lib:rep:open-orders');

async function loadRepOpenOrders(userId){
    try {
        if (!userId) {
            return [];
        }
        const sql = `SELECT h.Company,
                            h.SalesOrderNo,
                            h.ARDivisionNo,
                            h.ShipExpireDate,
                            h.CustomerNo,
                            h.BillToName,
                            h.OrderDate,
                            h.OrderType,
                            h.OrderStatus,
                            (h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt + h.SalesTaxAmt +
                             h.FreightAmt) as OrderTotal
                     from c2.SO_SalesOrderHeader h
                              INNER JOIN users.user_AR_Customer c using (Company, ARDivisionNo, CustomerNo)
                     WHERE c.userid = :userId
                       AND h.Company = 'chums'
                       AND h.OrderType NOT IN ('M', 'Q')
                     ORDER BY h.ShipExpireDate`;
        const [rows] = await mysql2Pool.query(sql, {userId});
        return rows;
    } catch(err) {
        if (err instanceof Error) {
            console.debug("loadRepOpenOrders()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadRepOpenOrders()", err);
        return Promise.reject(new Error('Error in loadRepOpenOrders()'));
    }
}

export const getOpenRepOrders = async (req, res) => {
    try {
        const orders = await loadRepOpenOrders(getUserValidation(res)?.profile?.user?.id);
        res.json({orders});
    } catch(err) {
        if (err instanceof Error) {
            debug("getOpenRepOrders()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getOpenRepOrders'});
    }
}
