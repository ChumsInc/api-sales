import { mysql2Pool } from "chums-local-modules";
import Debug from "debug";
const debug = Debug("chums:lib:audits:customization-order:customized-orders");
const sql = `
    WITH _Users as (
        SELECT UserKey, UserCode, FirstName, LastName, Active, Locked, EmailAddress
        FROM c2.SY_User       
    )
    SELECT soh.SalesOrderNo,
           CONCAT_WS('-', soh.ARDivisionNo, soh.CustomerNo)      AS CustomerKey,
           soh.BillToName,
           soh.OrderType,
           CONCAT_WS('/', soh.OrderStatus, soh.CancelReasonCode) AS OrderStatus,
           soh.OrderDate,
           soh.ShipExpireDate,
           soh.OrderTotal,
           (SELECT UserCode FROM _Users where UserKey = soh.UserCreatedKey) as CreatedBy,
           (SELECT UserCode FROM _Users where UserKey = soh.UserUpdatedKey) as LastUpdatedBy,
           DATE_ADD(soh.DateUpdated, INTERVAL soh.TimeUpdated * 3600 SECOND) as LastUpdated
    FROM c2.SO_SalesOrderHeader soh
    WHERE soh.OrderType IN ('S', 'Q')
      AND (IFNULL(:salesOrderNo, '') = '' OR soh.SalesOrderNo = :salesOrderNo)
      AND EXISTS (SELECT 1
                  FROM c2.SO_SalesOrderDetail sod
                           INNER JOIN c2.IM_CustomizationCode cc ON sod.ItemCode = cc.CustomizationCode
                  WHERE soh.SalesOrderNo = sod.SalesOrderNo)
`;
export async function loadCustomizedOrders(salesOrderNo) {
    try {
        const [rows] = await mysql2Pool.query(sql, { salesOrderNo });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCustomizedOrders()", err.message);
            return Promise.reject(err);
        }
        debug("loadCustomizedOrders()", err);
        return Promise.reject(new Error('Error in loadCustomizedOrders()'));
    }
}
