import {SACustomerRow, SAParams, SAQueryResult, SARow, SAShipToRow} from "../sa-types.js";
import {Connection, getConnection, parseSQL} from "chums-local-modules";
import Debug from "debug";
import {QueryValues} from "mysql2";
import {sqlCustomers} from "./sql-customers.js";
import {sqlItems} from "./sql-items.js";
import {sqlGLAccounts} from "./sql-gl-accounts.js";
import {sqlCleanup} from "./sql-cleanup.js";
import {buildResult} from "./result-utils.js";

const debug = Debug("chums:lib:analysis:v2:group-by-shipto-location");

export const sql = `
    WITH ProductStatus AS (SELECT ItemCode, WarehouseCode
                           FROM c2.IM_ItemWarehouseAdditional
                           WHERE company = 'chums'
                             AND ItemStatus REGEXP :ProductStatus),
         Sales AS (SELECT ih.ARDivisionNo,
                          ih.CustomerNo,
                          IFNULL(ih.ShipToCode, '')                                             AS ShipToCode,
                          SUM(IF(ih.InvoiceDate BETWEEN :p1min AND :p1max,
                                 id.QuantityShipped * id.UnitOfMeasureConvFactor, 0))           AS p1_shipped,
                          SUM(IF(ih.InvoiceDate BETWEEN :p1min AND :p1max, id.QuantityShipped * id.UnitCost,
                                 0))                                                            AS p1_cogs,
                          SUM(IF(ih.InvoiceDate BETWEEN :p1min AND :p1max, id.ExtensionAmt, 0)) AS p1_sales,
                          SUM(IF(ih.InvoiceDate BETWEEN :p2min AND :p2max,
                                 id.QuantityShipped * id.UnitOfMeasureConvFactor,
                                 0))                                                            AS p2_shipped,
                          SUM(IF(ih.InvoiceDate BETWEEN :p2min AND :p2max, id.QuantityShipped * id.UnitCost,
                                 0))                                                            AS p2_cogs,
                          SUM(IF(ih.InvoiceDate BETWEEN :p2min AND :p2max, id.ExtensionAmt, 0)) AS p2_sales
                   FROM c2.ar_invoicehistoryheader ih
                            INNER JOIN c2.ar_invoicehistorydetail id
                                       ON ih.InvoiceNo = id.InvoiceNo AND
                                          ih.HeaderSeqNo = id.HeaderSeqNo AND
                                          ih.Company = id.Company
                   WHERE (ih.InvoiceDate BETWEEN :p1min AND :p1max
                       OR ih.InvoiceDate BETWEEN :p2min AND :p2max)
                     AND ih.InvoiceType <> 'XD'
                     AND id.ItemCode <> '/C'
                     AND id.ExplodedKitItem <> 'C'
                     AND EXISTS (SELECT 1
                                 FROM TEMP_SA_Customers
                                 WHERE ARDivisionNo = ih.ARDivisionNo
                                   AND CustomerNo = ih.CustomerNo)
                     AND (
                       IF(@hasItemFilters
                           , EXISTS (SELECT 1
                                     FROM TEMP_SA_Items
                                     WHERE ItemCode = id.ItemCode)
                           , id.ItemType <> '4'
                       ))
                     AND (:SalesAccount IS NULL
                       OR EXISTS (SELECT 1 FROM TEMP_SA_Accounts WHERE AccountKey = id.SalesAcctKey))
                     AND (:CostAccount IS NULL
                       OR
                          EXISTS (SELECT 1 FROM TEMP_SA_Accounts WHERE AccountKey = id.CostOfGoodsSoldAcctKey))
                     AND (IFNULL(:ShipToCode, '') = ''
                       OR EXISTS (SELECT 1
                                  FROM TEMP_SA_ShipTo
                                  WHERE ARDivisionNo = ih.ARDivisionNo
                                    AND CustomerNo = ih.CustomerNo
                                    AND ShipToCode = IFNULL(ih.ShipToCode, '')))
                     AND (IFNULL(:ShipToState, '') = ''
                       OR ih.ShipToState REGEXP :ShipToState)
                     AND (IFNULL(:ProductStatus, '') = ''
                       OR EXISTS(SELECT 1
                                 FROM ProductStatus
                                 WHERE ItemCode = id.ItemCode
                                   AND WarehouseCode = id.WarehouseCode))
                   GROUP BY ih.ARDivisionNo, ih.CustomerNo, IFNULL(ih.ShipToCode, '')),
         Discounts AS (SELECT ih.ARDivisionNo,
                              ih.CustomerNo,
                              IFNULL(ih.ShipToCode, '') AS ShipToCode,
                              SUM(CASE
                                      WHEN ih.InvoiceDate BETWEEN :p1min AND :p1max
                                          THEN ih.DiscountAmt
                                      ELSE 0
                                  END)                  AS p1_discount,
                              SUM(CASE
                                      WHEN ih.InvoiceDate BETWEEN :p2min AND :p2max
                                          THEN ih.DiscountAmt
                                      ELSE 0
                                  END)                  AS p2_discount
                       FROM c2.ar_invoicehistoryheader ih
                       WHERE @hasItemFilters = 0
                         AND DiscountAmt <> 0
                         AND (ih.InvoiceDate BETWEEN :p1min AND :p1max
                           OR
                              ih.InvoiceDate BETWEEN :p2min AND :p2max)
                         AND ih.InvoiceType <> 'XD'
                         AND EXISTS (SELECT 1
                                     FROM TEMP_SA_Customers
                                     WHERE ARDivisionNo = ih.ARDivisionNo
                                       AND CustomerNo = ih.CustomerNo)
                         AND (IFNULL(:ShipToCode, '') = ''
                           OR EXISTS (SELECT 1
                                      FROM TEMP_SA_ShipTo
                                      WHERE ARDivisionNo = ih.ARDivisionNo
                                        AND CustomerNo = ih.CustomerNo
                                        AND ShipToCode = IFNULL(ih.ShipToCode, '')))
                         AND (IFNULL(:ShipToState, '') = '' OR ih.ShipToState REGEXP :ShipToState)
                       GROUP BY ih.ARDivisionNo, ih.CustomerNo, IFNULL(ih.ShipToCode, '')),
         OpenOrders AS (SELECT h.ARDivisionNo,
                               h.CustomerNo,
                               IFNULL(h.ShipToCode, '') AS ShipToCode,
                               SUM(
                                       IF(h.ShipExpireDate BETWEEN :p1min AND :p1max,
                                          (d.QuantityOrdered - d.QuantityShipped) * d.UnitOfMeasureConvFactor, 0)
                               )                        AS p1_open_qty,
                               SUM(
                                       IF(h.ShipExpireDate BETWEEN :p1min AND :p1max,
                                          (d.QuantityOrdered - d.QuantityShipped) * d.UnitPrice, 0)
                               )                        AS p1_open_sales,
                               SUM(
                                       IF(h.ShipExpireDate BETWEEN :p1min AND :p1max,
                                          (d.QuantityOrdered - d.QuantityShipped) * d.UnitCost, 0)
                               )                        AS p1_open_cost,
                               SUM(
                                       IF(h.ShipExpireDate BETWEEN :p2min AND :p2max,
                                          (d.QuantityOrdered - d.QuantityShipped) * d.UnitOfMeasureConvFactor, 0)
                               )                        AS p2_open_qty,
                               SUM(
                                       IF(h.ShipExpireDate BETWEEN :p2min AND :p2max,
                                          (d.QuantityOrdered - d.QuantityShipped) * d.UnitPrice, 0)
                               )                        AS p2_open_sales,
                               SUM(
                                       IF(h.ShipExpireDate BETWEEN :p2min AND :p2max,
                                          (d.QuantityOrdered - d.QuantityShipped) * d.UnitCost, 0)
                               )                        AS p2_open_cost
                        FROM c2.SO_SalesOrderHeader h
                                 INNER JOIN c2.SO_SalesOrderDetail d
                                            ON h.SalesOrderNo = d.SalesOrderNo AND h.Company = d.Company
                        WHERE (h.ShipExpireDate BETWEEN :p1min AND :p1max
                            OR h.ShipExpireDate BETWEEN :p2min AND :p2max)
                          AND h.OrderType IN ('B', 'S')
                          AND d.ItemCode <> '/C'
                          AND (d.SalesKitLineKey IS NULL OR d.ExplodedKitItem = 'Y')
                          AND EXISTS (SELECT 1
                                      FROM TEMP_SA_Customers
                                      WHERE ARDivisionNo = h.ARDivisionNo
                                        AND CustomerNo = h.CustomerNo)
                          AND (IF(@hasItemFilters
                            , EXISTS (SELECT 1
                                      FROM TEMP_SA_Items
                                      WHERE ItemCode = d.ItemCode)
                            , d.ItemType <> '4'))
                          AND (:SalesAccount IS NULL
                            OR EXISTS (SELECT 1 FROM TEMP_SA_Accounts WHERE AccountKey = d.SalesAcctKey))
                          AND (:CostAccount IS NULL
                            OR
                               EXISTS (SELECT 1 FROM TEMP_SA_Accounts WHERE AccountKey = d.CostOfGoodsSoldAcctKey))
                          AND (IFNULL(:ShipToCode, '') = ''
                            OR EXISTS (SELECT 1
                                       FROM TEMP_SA_ShipTo
                                       WHERE ARDivisionNo = h.ARDivisionNo
                                         AND CustomerNo = h.CustomerNo
                                         AND ShipToCode = IFNULL(h.ShipToCode, '')))
                          AND (IFNULL(:ShipToState, '') = ''
                            OR h.ShipToState REGEXP :ShipToState
                            )
                          AND (IFNULL(:ProductStatus, '') = ''
                            OR EXISTS(SELECT 1
                                      FROM ProductStatus
                                      WHERE ItemCode = d.ItemCode
                                        AND WarehouseCode = d.WarehouseCode))
                        GROUP BY h.ARDivisionNo, h.CustomerNo, IFNULL(h.ShipToCode, '')),
         Customers AS (SELECT ARDivisionNo, CustomerNo, '' AS ShipToCode
                       FROM c2.TEMP_SA_Customers
                       UNION
                       SELECT ARDivisionNo, CustomerNo, ShipToCode
                       FROM c2.TEMP_SA_ShipTo)
    SELECT IFNULL(CONCAT_WS('/', IFNULL(ShipTo.ShipToCountryCode, c.CountryCode),
                            IFNULL(ShipTo.ShipToState, c.State)),
                  'N/A')                                                AS key_field,
           IFNULL(IFNULL(ShipTo.ShipToState, c.State), '-')             AS StateCode,
           IFNULL(IFNULL(ShipTo.ShipToCountryCode, c.CountryCode), '-') AS CountryCode,
           s.StateName,
           cc.CountryName,
           SUM(IFNULL(Sales.p1_shipped, 0))                             AS p1_shipped,
           SUM(IFNULL(Discounts.p1_discount, 0))                        AS p1_discount,
           SUM(IFNULL(Sales.p1_sales, 0))                               AS p1_sales,
           SUM(IFNULL(Sales.p1_cogs, 0))                                AS p1_cogs,
           SUM(IFNULL(OpenOrders.p1_open_qty, 0))                       AS p1_open,
           SUM(IFNULL(OpenOrders.p1_open_sales, 0))                     AS p1_open_sales,
           SUM(IFNULL(OpenOrders.p1_open_cost, 0))                      AS p1_open_cogs,
           SUM(IFNULL(Sales.p2_shipped, 0))                             AS p2_shipped,
           SUM(IFNULL(Discounts.p2_discount, 0))                        AS p2_discount,
           SUM(IFNULL(Sales.p2_sales, 0))                               AS p2_sales,
           SUM(IFNULL(Sales.p2_cogs, 0))                                AS p2_cogs,
           SUM(IFNULL(OpenOrders.p2_open_qty, 0))                       AS p2_open,
           SUM(IFNULL(OpenOrders.p2_open_sales, 0))                     AS p2_open_sales,
           SUM(IFNULL(OpenOrders.p2_open_cost, 0))                      AS p2_open_cogs
    FROM Customers d
             INNER JOIN c2.ar_customer c ON d.ARDivisionNo = c.ARDivisionNo AND
                                            d.CustomerNo = c.CustomerNo
             LEFT JOIN c2.SO_ShipToAddress ShipTo
                       ON d.ARDivisionNo = ShipTo.ARDivisionNo AND
                          d.CustomerNo = ShipTo.CustomerNo AND
                          d.ShipToCode = ShipTo.ShipToCode
             LEFT JOIN Sales
                       ON d.ARDivisionNo = Sales.ARDivisionNo AND
                          d.CustomerNo = Sales.CustomerNo AND
                          d.ShipToCode = Sales.ShipToCode
             LEFT JOIN Discounts
                       ON d.ARDivisionNo = Discounts.ARDivisionNo AND
                          d.CustomerNo = Discounts.CustomerNo AND
                          d.ShipToCode = Discounts.ShipToCode
             LEFT JOIN OpenOrders
                       ON d.ARDivisionNo = OpenOrders.ARDivisionNo AND
                          d.CustomerNo = OpenOrders.CustomerNo AND
                          d.ShipToCode = OpenOrders.ShipToCode
             LEFT JOIN c2.SY_Country cc ON cc.CountryCode = IFNULL(ShipTo.ShipToCountryCode, c.CountryCode)
             LEFT JOIN c2.SY_State s ON s.CountryCode = IFNULL(ShipTo.ShipToCountryCode, c.CountryCode) AND
                                        s.StateCode = IFNULL(ShipTo.ShipToState, c.State)
    WHERE d.ARDivisionNo <> '00'
      AND (Sales.ARDivisionNo IS NOT NULL
        OR Discounts.ARDivisionNo IS NOT NULL
        OR OpenOrders.ARDivisionNo IS NOT NULL)
    GROUP BY IFNULL(CONCAT_WS('/', IFNULL(ShipTo.ShipToCountryCode, c.CountryCode),
                              IFNULL(ShipTo.ShipToState, c.State)),
                    'N/A'),
             IFNULL(IFNULL(ShipTo.ShipToState, c.State), '-'),
             IFNULL(IFNULL(ShipTo.ShipToCountryCode, c.CountryCode), '-'),
             s.StateName,
             cc.CountryName
    ORDER BY :orderBy
    LIMIT :limit;
`;

function getParsedSQL(params: Pick<SAParams, 'SortField'|'limit'>):string {
    return sql
        .replace(':orderBy', params.SortField.join(','))
        .replace(':limit', params.limit.toString())
}

async function loadAnalysis(params: SAParams): Promise<SARow<SAShipToRow>[]> {
    let connection: Connection | null = null;

    try {
        connection = await getConnection({
            multipleStatements: true,
        });

        await connection.query(sqlCustomers, params as QueryValues);
        await connection.query(sqlItems, params as QueryValues);
        await connection.query(sqlGLAccounts, params as QueryValues);
        const [results] = await connection.query<SARow<SAShipToRow>[]>(getParsedSQL(params), params as QueryValues);
        await connection.query(sqlCleanup);
        await connection.end();
        return buildResult(results, params);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadAnalysis()", err.message);
            return Promise.reject(err);
        }
        debug("loadAnalysis()", err);
        return Promise.reject(new Error('Error in loadAnalysis()'));
    } finally {
        if (connection && connection.state === 'connected') {
            await connection.end();
        }
    }
}

function getQuery(options: SAParams): string {
    const _sql = [
        sqlCustomers,
        sqlItems,
        sqlGLAccounts,
        getParsedSQL(options),
        sqlCleanup
    ].join('\n\n');
    return parseSQL(_sql, options);
}

export async function loadShipToLocationResults(params: SAParams, skipExec?: boolean): Promise<SAQueryResult<SACustomerRow>> {
    const query = await getQuery(params);
    if (skipExec) return {query, rows: []};
    try {
        const rows = await loadAnalysis(params);
        return {rows, query}
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.debug("loadShipToLocationResults()", err.message);
            return {error: err.message, query, rows: []}
        }
        console.debug("loadShipToLocationResults()", err);
        return {error: 'Unknown error in loadShipToLocationResults', query, rows: []}
    }
}
