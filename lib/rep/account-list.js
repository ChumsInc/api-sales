import Debug from 'debug';
import {buildWorkBook, mysql2Pool, resultToExcelSheet} from 'chums-local-modules';
import {addYears, formatISO9075, lastDayOfYear, parseISO, setDayOfYear} from 'date-fns';
import {loadOpenOrders, loadRecentOrders} from './rep-orders.js';

const debug = Debug('chums:lib:rep:account-list');

const GOAL = 1.15;

async function loadRepBillToTotal({userid, Company, asOfDate}) {
    try {
        const sql = `SELECT c.SalespersonDivisionNo,
                            c.SalespersonNo,
                            rep.SalespersonName,
                            IF(ISNULL(rep.SalespersonNo), 'Y', IFNULL(rep.UDF_TERMINATED, 'N')) AS TerminatedRep,
                            COUNT(DISTINCT c.Company, c.ARDivisionNo, c.CustomerNo)             AS Customers,
                            SUM(IFNULL(InvCY.InvCYTD, 0))                                       AS InvCYTD,
                            SUM(IFNULL(OpenCY.total, 0))                                        AS OpenOrders,
                            SUM(IFNULL(InvPYTD.total, 0))                                       AS InvPYTD,
                            SUM(IFNULL(InvPYr.total, 0))                                        AS InvPYr
                     FROM users.user_AR_Customer c
                              LEFT JOIN c2.ar_salesperson rep
                                        ON rep.Company = c.Company
                                            AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                            AND rep.SalespersonNo = c.SalespersonNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvCYTD
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(:CYCurrDate)
                                           AND InvoiceDate <= :CYCurrDate
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvCY
                                        ON InvCY.Company = c.Company AND
                                           InvCY.ARDivisionNo = c.ARDivisionNo AND
                                           InvCY.CustomerNo = c.CustomerNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo) OpenCY
                                        ON OpenCY.Company = c.Company
                                            AND OpenCY.ARDivisionNo = c.ARDivisionNo
                                            AND OpenCY.CustomerNo = c.CustomerNo

                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvPYTD
                                        ON InvPYTD.Company = c.Company
                                            AND InvPYTD.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYTD.CustomerNo = c.CustomerNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvPYr
                                        ON InvPYr.Company = c.Company AND InvPYr.ARDivisionNo = c.ARDivisionNo AND
                                           InvPYr.CustomerNo = c.CustomerNo
                     WHERE c.userid = :userid
                       AND c.primaryAccount = 1
                       AND c.Company = :Company
                       AND c.CustomerStatus = 'A'
                       AND c.ARDivisionNo NOT IN ('00', '10')
                     GROUP BY c.Company, c.SalespersonDivisionNo, c.SalespersonNo
                     ORDER BY c.Company, c.SalespersonDivisionNo, c.SalespersonNo`;
        if (!Company) {
            Company = 'chums';
        }
        const CYCurrDate = !asOfDate ? new Date() : new Date(asOfDate);
        const CYMinDate = setDayOfYear(CYCurrDate, 1);
        const PYMinDate = addYears(CYMinDate, -1);
        const PYCurrDate = addYears(CYCurrDate, -1);
        const PYMaxDate = lastDayOfYear(PYCurrDate);
        const args = {userid, Company, CYCurrDate, CYMinDate, PYMinDate, PYMaxDate, PYCurrDate};
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.InvCYTD = Number(row.InvCYTD);
            row.OpenOrders = Number(row.OpenOrders);
            row.InvPYTD = Number(row.InvPYTD);
            row.InvPYr = Number(row.InvPYr);
            row.YTDTotal = row.InvCYTD + row.OpenOrders;
            row.pctChange = row.InvPYTD === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (row.YTDTotal - row.InvPYTD) / Math.abs(row.InvPYTD);
            row.CYGoal = row.InvPYr * GOAL;
            row.YTDGoalPct = row.InvPYr === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (((row.OpenOrders + row.InvCYTD) - (row.InvPYr * GOAL)) / Math.abs(row.InvPYr * GOAL));
        });
        return rows;
    } catch (err) {
        debug("loadAccountList()", err.message);
        return Promise.reject(err);
    }
}

async function loadRepShipToTotal({userid, Company, asOfDate}) {
    try {
        const sql = `SELECT c.SalespersonDivisionNo,
                            c.SalespersonNo,
                            rep.SalespersonName,
                            IF(ISNULL(rep.SalespersonNo), 'Y', IFNULL(rep.UDF_TERMINATED, 'N')) AS TerminatedRep,
                            COUNT(DISTINCT c.Company, c.ARDivisionNo, c.CustomerNo)             AS Customers,
                            SUM(IFNULL(InvCY.InvCYTD, 0))                                       AS InvCYTD,
                            SUM(IFNULL(OpenCY.total, 0))                                        AS OpenOrders,
                            SUM(IFNULL(InvPYTD.total, 0))                                       AS InvPYTD,
                            SUM(IFNULL(InvPYr.total, 0))                                        AS InvPYr
                     FROM users.user_SO_ShipToAddress c
                              INNER JOIN c2.ar_customer ac
                                         ON ac.Company = c.Company
                                             AND ac.ARDivisionNo = c.ARDivisionNo
                                             AND ac.CustomerNo = c.CustomerNo
                              LEFT JOIN c2.ar_salesperson rep
                                        ON rep.Company = c.Company
                                            AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                            AND rep.SalespersonNo = c.SalespersonNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvCYTD
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(:CYCurrDate)
                                           AND InvoiceDate <= :CYCurrDate
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvCY
                                        ON InvCY.Company = c.Company AND
                                           InvCY.ARDivisionNo = c.ARDivisionNo AND
                                           InvCY.CustomerNo = c.CustomerNo AND
                                           InvCY.ShipToCode = c.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) OpenCY
                                        ON OpenCY.Company = c.Company
                                            AND OpenCY.ARDivisionNo = c.ARDivisionNo
                                            AND OpenCY.CustomerNo = c.CustomerNo
                                            AND OpenCY.ShipToCode = c.ShipToCode

                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYTD
                                        ON InvPYTD.Company = c.Company
                                            AND InvPYTD.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYTD.CustomerNo = c.CustomerNo
                                            AND InvPYTD.ShipToCode = c.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYr
                                        ON InvPYr.Company = c.Company
                                            AND InvPYr.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYr.CustomerNo = c.CustomerNo
                                            AND InvPYr.ShipToCode = c.ShipToCode
                     WHERE c.userid = :userid
                       AND c.primaryAccount = 1
                       AND c.Company = :Company
                       AND c.CustomerStatus = 'A'
                       AND ac.CustomerStatus = 'A'
                       AND c.ARDivisionNo NOT IN ('00', '10')
                       AND ac.SalespersonNo <> c.SalespersonNo
                     GROUP BY c.Company, c.SalespersonDivisionNo, c.SalespersonNo
                     ORDER BY c.Company, c.SalespersonDivisionNo, c.SalespersonNo`;
        if (!Company) {
            Company = 'chums';
        }
        const CYCurrDate = !asOfDate ? new Date() : new Date(asOfDate);
        const CYMinDate = setDayOfYear(CYCurrDate, 1);
        const PYMinDate = addYears(CYMinDate, -1);
        const PYCurrDate = addYears(CYCurrDate, -1);
        const PYMaxDate = lastDayOfYear(PYCurrDate);
        const args = {userid, Company, CYCurrDate, CYMinDate, PYMinDate, PYMaxDate, PYCurrDate};
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.InvCYTD = Number(row.InvCYTD);
            row.OpenOrders = Number(row.OpenOrders);
            row.InvPYTD = Number(row.InvPYTD);
            row.InvPYr = Number(row.InvPYr);
            row.YTDTotal = row.InvCYTD + row.OpenOrders;
            row.pctChange = row.InvPYTD === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (row.YTDTotal - row.InvPYTD) / Math.abs(row.InvPYTD);
            row.CYGoal = row.InvPYr * GOAL;
            row.YTDGoalPct = row.InvPYr === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (((row.OpenOrders + row.InvCYTD) - (row.InvPYr * GOAL)) / Math.abs(row.InvPYr * GOAL));
        });
        return rows;
    } catch (err) {
        debug("loadAccountList()", err.message);
        return Promise.reject(err);
    }
}

async function loadBillToAccountList({userid, Company, SalespersonNo, asOfDate}) {
    try {
        const sql = `SELECT c.ARDivisionNo,
                            c.CustomerNo,
                            c.CustomerName,
                            CONCAT_WS(', ', c.city, c.state, c.zipcode) AS CityStateZip,
                            c.ZipCode,
                            c.DateLastActivity,
                            c.SalespersonDivisionNo,
                            c.SalespersonNo,
                            rep.SalespersonName,
                            IFNULL(InvCY.InvCYTD, 0)                    AS InvCYTD,
                            IFNULL(OpenCY.total, 0)                     AS OpenOrders,
                            IFNULL(InvPYTD.total, 0)                    AS InvPYTD,
                            IFNULL(InvPYr.total, 0)                     AS InvPYr
                     FROM users.user_AR_Customer c
                              LEFT JOIN c2.ar_salesperson rep
                                        ON rep.Company = c.Company
                                            AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                            AND rep.SalespersonNo = c.SalespersonNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvCYTD
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(:CYCurrDate)
                                           AND InvoiceDate <= :CYCurrDate
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvCY
                                        ON InvCY.Company = c.Company AND InvCY.ARDivisionNo = c.ARDivisionNo AND
                                           InvCY.CustomerNo = c.CustomerNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo) OpenCY
                                        ON OpenCY.Company = c.Company
                                            AND OpenCY.ARDivisionNo = c.ARDivisionNo
                                            AND OpenCY.CustomerNo = c.CustomerNo

                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvPYTD
                                        ON InvPYTD.Company = c.Company
                                            AND InvPYTD.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYTD.CustomerNo = c.CustomerNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo) InvPYr
                                        ON InvPYr.Company = c.Company AND InvPYr.ARDivisionNo = c.ARDivisionNo AND
                                           InvPYr.CustomerNo = c.CustomerNo
                     WHERE c.userid = :userid
                       AND c.primaryAccount = 1
                       AND c.Company = :Company
                       AND c.CustomerStatus = 'A'
                       AND c.SalespersonNo = :SalespersonNo
                       AND c.ARDivisionNo NOT IN ('00', '10')
                     ORDER BY InvCYTD + InvPYr DESC,
                              InvCYTD DESC,
                              InvPYr DESC`;
        if (!Company) {
            Company = 'chums';
        }
        const CYCurrDate = !asOfDate ? new Date() : parseISO(asOfDate);
        const CYMinDate = setDayOfYear(CYCurrDate, 1);
        const PYMinDate = addYears(CYMinDate, -1);
        const PYCurrDate = addYears(CYCurrDate, -1);
        const PYMaxDate = lastDayOfYear(PYCurrDate);
        const args = {
            userid, Company,
            CYCurrDate: formatISO9075(CYCurrDate, {representation: 'date'}),
            CYMinDate: formatISO9075(CYMinDate, {representation: 'date'}),
            PYMinDate: formatISO9075(PYMinDate, {representation: 'date'}),
            PYMaxDate: formatISO9075(PYMaxDate, {representation: 'date'}),
            PYCurrDate: formatISO9075(PYCurrDate, {representation: 'date'}),
            SalespersonNo
        };

        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.InvCYTD = Number(row.InvCYTD) || 0;
            row.OpenOrders = Number(row.OpenOrders) || 0;
            row.Pace = row.InvCYTD + row.OpenOrders;
            row.InvPYTD = Number(row.InvPYTD);
            row.InvPYr = Number(row.InvPYr);
            row.YTDTotal = row.InvCYTD + row.OpenOrders;
            row.pctChange = row.InvPYTD === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (row.YTDTotal - row.InvPYTD) / Math.abs(row.InvPYTD);
            row.CYGoal = row.InvPYTD * GOAL;
            row.YTDGoalPct = row.InvPYr === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (((row.OpenOrders + row.InvCYTD) - row.InvPYr * GOAL) / Math.abs(row.InvPYr * GOAL));
        })
        return rows;
    } catch (err) {
        debug("loadAccountList()", err.message);
        return Promise.reject(err);
    }
}

async function loadShipToAccountList({userid, Company, SalespersonNo, asOfDate}) {
    try {
        const sql = `SELECT c.ARDivisionNo,
                            c.CustomerNo,
                            c.CustomerName,
                            c.ShipToCode,
                            c.ShipToName,
                            CONCAT_WS(', ', c.ShipToCity, c.ShipToState, c.ShipToZipCode) AS CityStateZip,
                            c.SalespersonDivisionNo,
                            c.SalespersonNo,
                            rep.SalespersonName,
                            IFNULL(InvCY.InvCYTD, 0)                                      AS InvCYTD,
                            IFNULL(OpenCY.total, 0)                                       AS OpenOrders,
                            IFNULL(InvPYTD.total, 0)                                      AS InvPYTD,
                            IFNULL(InvPYr.total, 0)                                       AS InvPYr
                     FROM users.user_SO_ShipToAddress c
                              INNER JOIN c2.ar_customer ac
                                         ON ac.Company = c.Company
                                             AND ac.ARDivisionNo = c.ARDivisionNo
                                             AND ac.CustomerNo = c.CustomerNo
                              LEFT JOIN c2.ar_salesperson rep
                                        ON rep.Company = c.Company
                                            AND rep.SalespersonDivisionNo = c.SalespersonDivisionNo
                                            AND rep.SalespersonNo = c.SalespersonNo
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS InvCYTD
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(:CYCurrDate)
                                           AND InvoiceDate <= :CYCurrDate
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvCY
                                        ON InvCY.Company = c.Company
                                            AND InvCY.ARDivisionNo = c.ARDivisionNo
                                            AND InvCY.CustomerNo = c.CustomerNo
                                            AND InvCY.ShipToCode = c.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(taxableamt + NonTaxableAmt - DiscountAmt) AS total
                                         FROM c2.SO_SalesOrderHeader
                                         WHERE OrderStatus IN ('N', 'A', 'O', 'H')
                                           AND YEAR(ShipExpireDate) <= YEAR(:CYCurrDate)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) OpenCY
                                        ON OpenCY.Company = c.Company
                                            AND OpenCY.ARDivisionNo = c.ARDivisionNo
                                            AND OpenCY.CustomerNo = c.CustomerNo
                                            AND OpenCY.ShipToCode = c.ShipToCode

                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                           AND InvoiceDate <= DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR)
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYTD
                                        ON InvPYTD.Company = c.Company
                                            AND InvPYTD.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYTD.CustomerNo = c.CustomerNo
                                            AND InvPYTD.ShipToCode = c.ShipToCode
                              LEFT JOIN (SELECT Company,
                                                ARDivisionNo,
                                                CustomerNo,
                                                ShipToCode,
                                                SUM(TaxableSalesAmt + NonTaxableSalesAmt - DiscountAmt) AS total
                                         FROM c2.ar_invoicehistoryheader
                                         WHERE YEAR(InvoiceDate) = YEAR(DATE_SUB(:CYCurrDate, INTERVAL 1 YEAR))
                                         GROUP BY Company, ARDivisionNo, CustomerNo, ShipToCode) InvPYr
                                        ON InvPYr.Company = c.Company
                                            AND InvPYr.ARDivisionNo = c.ARDivisionNo
                                            AND InvPYr.CustomerNo = c.CustomerNo
                                            AND InvPYr.ShipToCode = c.ShipToCode
                     WHERE c.userid = :userid
                       AND c.primaryAccount = 1
                       AND c.Company = :Company
                       AND c.CustomerStatus = 'A'
                       AND ac.CustomerStatus = 'A'
                       AND c.SalespersonNo = :SalespersonNo
                       AND c.ARDivisionNo NOT IN ('00', '10')
                       AND ac.SalespersonNo <> :SalespersonNo
                     ORDER BY ARDivisionNo, CustomerNo, ShipToCode`;
        if (!Company) {
            Company = 'chums';
        }
        const CYCurrDate = !asOfDate ? new Date() : parseISO(asOfDate);
        const CYMinDate = setDayOfYear(CYCurrDate, 1);
        const PYMinDate = addYears(CYMinDate, -1);
        const PYCurrDate = addYears(CYCurrDate, -1);
        const PYMaxDate = lastDayOfYear(PYCurrDate);
        const args = {
            userid, Company,
            CYCurrDate: formatISO9075(CYCurrDate, {representation: 'date'}),
            CYMinDate: formatISO9075(CYMinDate, {representation: 'date'}),
            PYMinDate: formatISO9075(PYMinDate, {representation: 'date'}),
            PYMaxDate: formatISO9075(PYMaxDate, {representation: 'date'}),
            PYCurrDate: formatISO9075(PYCurrDate, {representation: 'date'}),
            SalespersonNo
        };
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.InvCYTD = Number(row.InvCYTD);
            row.OpenOrders = Number(row.OpenOrders);
            row.InvPYTD = Number(row.InvPYTD);
            row.InvPYr = Number(row.InvPYr);
            row.YTDTotal = row.InvCYTD + row.OpenOrders;
            row.pctChange = row.InvPYTD === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (row.YTDTotal - row.InvPYTD) / Math.abs(row.InvPYTD);
            row.CYGoal = row.InvPYTD * GOAL;
            row.YTDGoalPct = row.InvPYr === 0
                ? (row.YTDTotal > 0 ? 1 : 0)
                : (((row.OpenOrders + row.InvCYTD) - row.InvPYr * GOAL) / Math.abs(row.InvPYr * GOAL));
        })
        return rows;
    } catch (err) {
        debug("loadAccountList()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @return {Promise<void>}
 */
export const getRepAccounts = async (req, res) => {
    try {
        const params = {
            ...req.params,
            userid: res.locals?.profile?.user?.id || 0,
        }
        const [accounts, shipTo, recentOrders, openOrders] = await Promise.all([
            loadBillToAccountList(params),
            loadShipToAccountList(params),
            loadRecentOrders(params),
            loadOpenOrders(params),
        ]);
        res.json({accounts, shipTo, recentOrders, openOrders});
    } catch (err) {
        debug("getBillToAccounts()", err.message);
        res.json({error: err.message});
    }
}


/**
 *
 * @param {BillToCustomer[]} rows
 * @return {BillToCustomer[]}
 */
const prepBillToAccounts = (rows) => {
    return rows.map(row => {
        const {
            CustomerName,
            CityStateZip,
            InvCYTD,
            OpenOrders,
            InvPYTD,
            InvPYr,
            YTDTotal,
            pctChange,
            CYGoal,
            YTDGoalPct
        } = row;
        return {
            CustomerNo: [row.ARDivisionNo, row.CustomerNo].join('-'),
            CustomerName,
            CustomerAddress: CityStateZip,
            SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
            InvCYTD,
            OpenOrders,
            InvPYTD,
            InvPYr,
            YTDTotal,
            pctChange,
            CYGoal,
            YTDGoalPct,
        }
    })
}

/**
 *
 * @param {ShipToCustomer[]} rows
 * @return {ShipToCustomer[]}
 */
const prepShipToAccounts = (rows) => {
    return rows.map(row => {
        const {
            CustomerName,
            CityStateZip,
            InvCYTD,
            OpenOrders,
            InvPYTD,
            InvPYr,
            YTDTotal,
            pctChange,
            CYGoal,
            YTDGoalPct
        } = row;
        return {
            CustomerNo: [row.ARDivisionNo, row.CustomerNo].join('-') + (!!row.ShipToCode ? `/${row.ShipToCode}` : ''),
            CustomerName,
            CustomerAddress: CityStateZip,
            SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
            InvCYTD,
            OpenOrders,
            InvPYTD,
            InvPYr,
            YTDTotal,
            pctChange,
            CYGoal,
            YTDGoalPct,
        }
    })
}

/**
 *
 * @param {string} asOfDate
 * @return {{}}
 * @constructor
 */
const billToColumnNames = (asOfDate) => {
    const CYCurrDate = !asOfDate ? new Date() : parseISO(asOfDate);
    const PYMinDate = addYears(CYCurrDate, -1);

    return {
        CustomerNo: 'Customer #',
        CustomerName: 'Customer Name',
        CustomerAddress: 'Customer Location',
        InvCYTD: `${CYCurrDate.getFullYear()} YTD`,
        OpenOrders: 'Open Orders',
        YTDTotal: `${CYCurrDate.getFullYear()} Total`,
        InvPYTD: `${PYMinDate.getFullYear()} YTD`,
        InvPYr: `${PYMinDate.getFullYear()} Total`,
        pctChange: `${CYCurrDate.getFullYear()} Growth %`,
        CYGoal: `${CYCurrDate.getFullYear()} Goal`,
        YTDGoalPct: `${CYCurrDate.getFullYear()} Goal %`,
    }
}

/**
 *
 * @param {string} asOfDate
 * @return {{}}
 * @constructor
 */
const shipToColumnNames = (asOfDate) => {
    const CYCurrDate = !asOfDate ? new Date() : parseISO(asOfDate);
    const PYMinDate = addYears(CYCurrDate, -1);

    return {
        CustomerNo: 'Customer #',
        CustomerName: 'Customer Name',
        CustomerAddress: 'Customer Location',
        InvCYTD: `${CYCurrDate.getFullYear()} YTD`,
        OpenOrders: 'Open Orders',
        YTDTotal: `${CYCurrDate.getFullYear()} Total`,
        InvPYTD: `${PYMinDate.getFullYear()} YTD`,
        InvPYr: `${PYMinDate.getFullYear()} Total`,
        pctChange: `${CYCurrDate.getFullYear()} Growth %`,
        CYGoal: `${CYCurrDate.getFullYear()} Goal`,
        YTDGoalPct: `${CYCurrDate.getFullYear()} Goal %`,
    }
}
/**
 *
 * @param {RecentOrder[]} rows
 * @return {RecentOrder[]}
 */
const prepRecentOrders = (rows) => {
    return rows.map(row => {
        return {
            ...row,
            SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
            CustomerNo: [row.ARDivisionNo, row.CustomerNo].join('-') + (!!row.ShipToCode ? `/${row.ShipToCode}` : ''),
            ShipToCity: [row.ShipToCity, row.ShipToState].join(', '),
        }
    })
}

/**
 *
 * @param {OpenOrder[]} rows
 * @return {OpenOrder[]}
 */
const prepOpenOrders = (rows) => {
    return rows
        .filter(row => !(row.B2BOrder === 'Y' && row.OrderType === 'Q'))
        .map(row => {
            return {
                ...row,
                SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
                CustomerNo: [row.ARDivisionNo, row.CustomerNo].join('-') + (!!row.ShipToCode ? `/${row.ShipToCode}` : ''),
                ShipToCity: [row.ShipToCity, row.ShipToState].join(', '),
            }
        })
}

/**
 *
 * @param {OpenOrder[]} rows
 * @return {OpenOrder[]}
 */
const prepOpenCarts = (rows) => {
    return rows
        .filter(row => (row.B2BOrder === 'Y' && row.OrderType === 'Q'))
        .map(row => {
            return {
                ...row,
                SalespersonNo: [row.SalespersonDivisionNo, row.SalespersonNo].join('-'),
                CustomerNo: [row.ARDivisionNo, row.CustomerNo].join('-') + (!!row.ShipToCode ? `/${row.ShipToCode}` : ''),
                ShipToCity: [row.ShipToCity, row.ShipToState].join(', '),
            }
        })
}

/**
 *
 * @return {RecentOrder}
 */
const recentOrdersColumnNames = {
    SalesOrderNo: 'S/O #',
    SalespersonNo: 'Rep #',
    OrderDate: 'Order Date',
    B2BOrder: '',
    CustomerNo: 'Customer #',
    BillToName: 'Customer Name',
    ShipToCity: 'Ship To',
    InvoiceNo: 'Invoice #',
    InvoiceDate: 'Invoice Date',
    InvoiceTotal: 'Invoice Total'
}

/**
 *
 * @return {OpenOrder}
 */
const openOrdersColumnNames = {
    SalesOrderNo: 'S/O #',
    SalespersonNo: 'Rep #',
    OrderDate: 'Order Date',
    B2BOrder: 'B2B Order',
    CustomerNo: 'Customer #',
    BillToName: 'Customer Name',
    ShipToCity: 'Ship To',
    ShipExpireDate: 'Ship Date',
    OrderTotal: 'Order Total',
    CancelReasonCodeDesc: 'Notes'
}

/**
 *
 * @return {OpenOrder}
 */
const openCartsColumnNames = {
    SalesOrderNo: 'S/O #',
    SalespersonNo: 'Rep #',
    OrderDate: 'Order Date',
    B2BOrder: 'B2B Order',
    CustomerNo: 'Customer #',
    BillToName: 'Customer Name',
    ShipToCity: 'Ship To',
    ShipExpireDate: 'Expire Date',
    OrderTotal: 'Order Total',
    CancelReasonCodeDesc: 'Notes'
}


/**
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @return {Promise<void>}
 */
export const getRepAccountsXLSX = async (req, res) => {
    try {
        const params = {
            ...req.params,
            userid: res.locals?.profile?.user?.id || 0,
        }
        const [accounts, shipTo, recentOrders, openOrders] = await Promise.all([
            loadBillToAccountList(params),
            loadShipToAccountList(params),
            loadRecentOrders(params),
            loadOpenOrders(params),
        ]);
        const billToSheet = resultToExcelSheet(prepBillToAccounts(accounts), billToColumnNames(params.asOfDate), true);
        const shipToSheet = resultToExcelSheet(prepShipToAccounts(shipTo), shipToColumnNames(params.asOfDate), true);
        const recentOrdersSheet = resultToExcelSheet(prepRecentOrders(recentOrders), recentOrdersColumnNames, true);
        const openOrdersSheet = resultToExcelSheet(prepOpenOrders(openOrders), openOrdersColumnNames, true);
        const cartOrdersSheet = resultToExcelSheet(prepOpenCarts(openOrders), openCartsColumnNames, true);
        const sheets = {
            'Bill-To Accounts': billToSheet,
            'Ship-To Accounts': shipToSheet,
            'Recent Orders': recentOrdersSheet,
            'Open Orders': openOrdersSheet,
            'Open B2B Carts': cartOrdersSheet,
        };
        const workbook = await buildWorkBook(sheets, {
            bookType: 'xlsx',
            bookSST: true,
            type: 'buffer',
            compression: true
        });
        const filename = new Date().toISOString();
        res.setHeader('Content-disposition', `attachment; filename=RepAccountList-${filename}.xlsx`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(workbook);
    } catch (err) {
        debug("getRepAccountsXLSX()", err.message);
        res.json({error: err.message});
    }
}


/**
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @return {Promise<void>}
 */
export const getRepTotals = async (req, res) => {
    try {
        const params = {
            ...req.params,
            userid: res.locals?.profile?.user?.id || 0,
        }
        const [reps, shipToReps] = await Promise.all([
            loadRepBillToTotal(params),
            loadRepShipToTotal(params),
        ])
        res.json({reps, shipToReps});
    } catch (err) {
        debug("getBillToAccounts()", err.message);
        res.json({error: err.message});
    }
}

