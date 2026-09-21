import Debug from "debug";
import { mysql2Pool } from "chums-local-modules";
const debug = Debug("chums:lib:store-map:web-store-locator");
const sql = `
    WITH LastInvoiceDate AS (SELECT h.ARDivisionNo,
                                    h.CustomerNo,
                                    MAX(CONCAT_WS('-', FiscalYear, FiscalPeriod)) AS LastInvoice
                             FROM c2.AR_CustomerSalesHistory h
                             WHERE NumberOfInvoices > 0
                             GROUP BY ARDivisionNo, CustomerNo)
    SELECT sta.ARDivisionNo,
           sta.CustomerNo,
           sta.ShipToCode,
           sta.ShipToName                                              AS CustomerName,
           sta.ShipToAddress1                                          AS AddressLine1,
           sta.ShipToAddress2                                          AS AddressLine2,
           sta.ShipToAddress3                                          AS AddressLine3,
           sta.ShipToCity                                              AS City,
           sta.ShipToState                                             AS State,
           sta.ShipToZipCode                                           AS ZipCode,
           sta.ShipToCountryCode                                       AS CountryCode,
           c.URLAddress,
           sta.UDF_RESELLER                                            AS reseller,
           ST_Y(l.location)                                            AS latitude,
           ST_X(l.location)                                            AS longitude,
           l.lookupresult                                              AS lookupResult,
           l.LocationType,
           ST_DISTANCE_SPHERE(POINT(:lon, :lat), l.location) / 1609.34 AS distance,
           'ShipTo'                                                    AS StoreType,
           inv.LastInvoice                                             AS LastInvoice
    FROM c2.SO_ShipToAddress sta
             INNER JOIN c2.AR_Customer2 c
                        ON sta.ARDivisionNo = c.ARDivisionNo AND
                           sta.CustomerNo = c.CustomerNo
             INNER JOIN c2.ar_customer_location l
                        ON sta.ARDivisionNo = l.ARDivisionNo AND
                           sta.CustomerNo = l.CustomerNo AND
                           sta.ShipToCode = l.ShipToCode
             LEFT JOIN LastInvoiceDate inv
                       ON sta.ARDivisionNo = inv.ARDivisionNo AND
                          sta.CustomerNo = inv.CustomerNo
    WHERE EXISTS (SELECT 1
                  FROM users.UserCustomerAccess uac
                  WHERE userId = :userId
                    AND (
                      (uac.SalespersonDivisionNo = '%' AND uac.SalespersonNo = '%')
                          OR
                      (c.SalespersonDivisionNo = uac.SalespersonDivisionNo AND c.SalespersonNo = uac.SalespersonNo)
                          OR (uac.ARDivisionNo = c.ARDivisionNo AND uac.CustomerNo = uac.CustomerNo AND
                              uac.ShipToCode = sta.ShipToCode)
                      ))
      AND c.CustomerStatus = 'A'
      AND ST_X(l.location) <> 0
      AND ST_Y(l.location) <> 0
      AND (IFNULL(:arDivisionNo, '') = '' OR c.ARDivisionNo = :arDivisionNo)
      AND (IFNULL(:customerNo, '') = '' OR c.CustomerNo = :customerNo)
      AND (IFNULL(:reseller, '') = '' OR sta.UDF_RESELLER = :reseller)
      AND (IFNULL(:minDate, '') = '' OR inv.LastInvoice >= :minDate)
      AND (IFNULL(:maxDate, '') = '' OR inv.LastInvoice <= :maxDate)
      AND ST_DISTANCE_SPHERE(POINT(:lon, :lat), l.location) < (:distance * 1609.34)

    UNION ALL

    SELECT c.ARDivisionNo,
           c.CustomerNo,
           ''                                                          AS ShipToCode,
           c.CustomerName,
           c.AddressLine1,
           c.Addressline2,
           c.Addressline3,
           c.City,
           c.State,
           c.ZipCode,
           c.CountryCode,
           c.URLAddress,
           c.UDF_RESELLER                                              AS reseller,
           ST_Y(l.location)                                            AS latitude,
           ST_X(l.location)                                            AS longitude,
           l.lookupresult                                              AS lookupResult,
           l.LocationType,
           ST_DISTANCE_SPHERE(POINT(:lon, :lat), l.location) / 1609.34 AS distance,
           'BillTo'                                                    AS StoreType,
           inv.LastInvoice                                             AS LastInvoice
    FROM c2.AR_Customer2 c
             INNER JOIN c2.ar_customer_location l
                        ON c.ARDivisionNo = l.ARDivisionNo AND c.CustomerNo = l.CustomerNo AND
                           l.ShipToCode = ''
             LEFT JOIN LastInvoiceDate inv
                       ON c.ARDivisionNo = inv.ARDivisionNo AND c.CustomerNo = inv.CustomerNo
    WHERE EXISTS (SELECT 1
                  FROM users.UserCustomerAccess uac
                  WHERE userId = :userId
                    AND (
                      (uac.SalespersonDivisionNo = '%' AND uac.SalespersonNo = '%')
                          OR
                      (c.SalespersonDivisionNo = uac.SalespersonDivisionNo AND c.SalespersonNo = uac.SalespersonNo)
                          OR
                      (uac.ARDivisionNo = c.ARDivisionNo AND uac.CustomerNo = uac.CustomerNo AND uac.ShipToCode IS NULL)
                      ))
      AND c.CustomerStatus = 'A'
      AND ST_X(l.location) <> 0
      AND ST_Y(l.location) <> 0
      AND (IFNULL(:arDivisionNo, '') = '' OR c.ARDivisionNo = :arDivisionNo)
      AND (IFNULL(:customerNo, '') = '' OR c.CustomerNo = :customerNo)
      AND (IFNULL(:reseller, '') = '' OR c.UDF_RESELLER = :reseller)
      AND (IFNULL(:minDate, '') = '' OR inv.LastInvoice >= :minDate)
      AND (IFNULL(:maxDate, '') = '' OR inv.LastInvoice <= :maxDate)
      AND ST_DISTANCE_SPHERE(POINT(:lon, :lat), l.location) < (:distance * 1609.34)

    UNION ALL

    SELECT c.ARDivisionNo,
           c.CustomerNo,
           ''                                                          AS ShipToCode,
           c.CustomerName,
           stores.Address1,
           stores.Address2,
           stores.Address3,
           stores.City,
           stores.State,
           stores.ZipCode,
           stores.CountryCode,
           stores.url,
           'Y'                                                         AS resller,
           ST_Y(l.location)                                            AS latitude,
           ST_X(l.location)                                            AS longitude,
           l.lookupresult                                              AS lookupResult,
           l.LocationType,
           ST_DISTANCE_SPHERE(POINT(:lon, :lat), l.location) / 1609.34 AS distance,
           'Custom'                                                    AS StoreType,
           inv.LastInvoice
    FROM c2.AR_Customer2 c
             INNER JOIN c2.web_additionalstores stores
                        ON c.ARDivisionNo = stores.ARDivisionNo AND
                           c.CustomerNo = stores.CustomerNo
             INNER JOIN c2.ar_customer_location l
                        ON c.ARDivisionNo = l.ARDivisionNo AND
                           c.CustomerNo = l.CustomerNo AND
                           l.ShipToCode = stores.ShipToCode
             LEFT JOIN LastInvoiceDate inv
                       ON c.ARDivisionNo = inv.ARDivisionNo AND c.CustomerNo = inv.CustomerNo
    WHERE EXISTS (SELECT 1
                  FROM users.UserCustomerAccess uac
                  WHERE userId = :userId
                    AND (
                      (uac.SalespersonDivisionNo = '%' AND uac.SalespersonNo = '%')
                          OR
                      (c.SalespersonDivisionNo = uac.SalespersonDivisionNo AND c.SalespersonNo = uac.SalespersonNo)
                          OR
                      (uac.ARDivisionNo = c.ARDivisionNo AND uac.CustomerNo = uac.CustomerNo AND uac.ShipToCode IS NULL)
                      ))
      AND c.CustomerStatus = 'A'
      AND ST_X(l.location) <> 0
      AND ST_Y(l.location) <> 0
      AND (IFNULL(:arDivisionNo, '') = '' OR c.ARDivisionNo = :arDivisionNo)
      AND (IFNULL(:customerNo, '') = '' OR c.CustomerNo = :customerNo)
      AND (IFNULL(:minDate, '') = '' OR inv.LastInvoice >= :minDate)
      AND (IFNULL(:maxDate, '') = '' OR inv.LastInvoice <= :maxDate)
      AND ST_DISTANCE_SPHERE(POINT(:lon, :lat), l.location) < (:distance * 1609.34)

    ORDER BY distance, ARDivisionNo, CustomerNo, ShipToCode, CustomerName`;
export async function loadStoresByLocation(arg) {
    try {
        const params = {
            userId: arg.userId,
            lat: +(arg.lat ?? 0),
            lon: +(arg.lon ?? 0),
            distance: arg.range,
            arDivisionNo: arg.arDivisionNo,
            customerNo: arg.customerNo,
            reseller: arg.reseller ?? null,
            minDate: arg.minDate ?? null,
            maxDate: arg.maxDate ?? null,
        };
        debug("loadStoresByLocation()", params);
        const [rows] = await mysql2Pool.query(sql, params);
        const validLookup = ['200', 'OK', 'FIXED'];
        return rows.map(row => {
            return {
                ...row,
                latitude: +(row.latitude ?? 0),
                longitude: +(row.longitude ?? 0),
                distance: +(row.distance ?? 0),
                reseller: row.reseller === 'Y',
                valid: row.reseller === 'Y' && validLookup.includes(row.lookupResult ?? ''),
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadStoresByLocation()", err.message, arg);
            return Promise.reject(err);
        }
        debug("loadStoresByLocation()", err);
        return Promise.reject(new Error('Error in loadStoresByLocation()'));
    }
}
export async function getStoresForWeb(req, res) {
    try {
        const lat = req.query.lat ?? '0';
        const lon = req.query.lng ?? '0';
        let range = +(req.query.range ?? '0');
        if (!range) {
            range = 25;
        }
        const [arDivisionNo, customerNo] = req.query.cust?.split('-') ?? [null, null];
        const reseller = req.query.reseller === 'Yes' ? 'Y' : null;
        if (arDivisionNo && customerNo) {
            range = 5000;
        }
        const results = await loadStoresByLocation({
            userId: res.locals.profile.user.id,
            lat: lat,
            lon: lon,
            range: range,
            arDivisionNo,
            customerNo,
            minDate: req.query.minDate,
            maxDate: req.query.maxDate,
            reseller
        });
        res.json({ list: results });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getStoresForWeb()", err.message);
            res.json({ error: 'An error occurred when loading stores', name: err.name });
            return;
        }
        res.json({ error: 'unknown error in when loading stores' });
    }
}
