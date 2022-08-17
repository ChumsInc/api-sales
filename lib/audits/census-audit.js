const Debug = require('debug');
const {mysql2Pool, resultToExcelSheet, buildWorkBook, buildXLSXHeaders} = require('chums-local-modules');
const {format, parseJSON} = require('date-fns');

const debug = Debug('chums:lib:audits:census-audit');

async function loadAuditData({minDate, maxDate}) {
    try {
        const sql = `
            SELECT ''                                                                AS LOCATION_ID,
                   h.InvoiceNo                                                       AS SHIPMENT_ID,
                   h.InvoiceDate                                                     AS SHIPMENT_DATE,
                   h.TaxableSalesAmt + h.NonTaxableSalesAmt                          AS SHIPMENT_VALUE,
                   ROUND(IFNULL(it.Weight, h.Weight))                                AS SHIPMENT_WEIGHT,
                   'OUTDOOR ACCESSORY'                                               AS PRODUCT_DESCRIPTION,
                   'N'                                                               AS TEMPERATURE_CONTROL_FLAG,
                   ''                                                                AS HAZMAT_CODE,
                   IF(h.ShipToCountryCode IN ('US', 'USA'), h.ShipToCity, '')        AS DOMESTIC_CITY_NAME,
                   IF(h.ShipToCountryCode IN ('US', 'USA'), h.ShipToState, '')       AS DOMESTIC_STATE_ABBREV,
                   IF(h.ShipToCountryCode IN ('US', 'USA'), h.ShipToZipCode, '')     AS DOMESTIC_ZIP_CODE,
                   IF(h.ShipToCountryCode IN ('US', 'USA'), IFNULL(tm.transport_mode, '0'),
                      '')                                                            AS DOMESTIC_TRANSPORT_MODES,
                   IF(h.ShipToCountryCode IN ('US', 'USA') AND ISNULL(tm.transport_mode), h.ShipVia,
                      '')                                                            AS DOMESTIC_TRANSPORT_WRITEIN,
                   IF(h.ShipToCountryCode NOT IN ('US', 'USA'), h.ShipToCity, '')    AS EXPORT_CITY_NAME,
                   IF(h.ShipToCountryCode NOT IN ('US', 'USA'), c.CountryName, '')   AS EXPORT_COUNTRY_NAME,
                   IF(h.ShipToCountryCode NOT IN ('US', 'USA'), h.ShipToZipCode, '') AS EXPORT_POSTAL_CODE,
                   IF(h.ShipToCountryCode NOT IN ('US', 'USA'), h.ShipVia, '')       AS EXPORT_TRANSPORT_MODE,
                   IF(h.ShipToCountryCode NOT IN ('US', 'USA') AND ISNULL(tm.transport_mode), h.ShipVia,
                      '')                                                            AS EXPORT_TRANSPORT_WRITEIN
            FROM c2.ar_invoicehistoryheader h
                 LEFT JOIN (
                SELECT Company, InvoiceNo, HeaderSeqNo, SUM(t.Weight) AS Weight
                FROM c2.AR_InvoiceHistoryTracking t
                GROUP BY Company, InvoiceNo, HeaderSeqNo
                ) it
                           USING (Company, InvoiceNo, HeaderSeqNo)
                 LEFT JOIN c2.SY_Country c
                           ON c.CountryCode = h.ShipToCountryCode
                 LEFT JOIN c2.census_transport_modes tm
                           ON tm.ShipVia = h.ShipVia
            WHERE h.Company = 'chums'
              AND h.InvoiceType = 'IN'
              AND (h.TaxableSalesAmt + h.NonTaxableSalesAmt) > 0
              AND IFNULL(it.Weight, h.Weight) <> 0
              AND h.InvoiceDate BETWEEN :minDate AND :maxDate
        `;
        const [rows] = await mysql2Pool.query(sql, {minDate, maxDate});
        rows.forEach(row => {
            row.SHIPMENT_DATE = format(new Date(row.SHIPMENT_DATE), 'MM/dd/Y');
            row.SHIPMENT_VALUE = +row.SHIPMENT_VALUE;
            row.SHIPMENT_WEIGHT = +row.SHIPMENT_WEIGHT;
        })
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadAuditData()", err.message);
            return Promise.reject(err);
        }
        debug("loadAuditData()", err);
        return Promise.reject(new Error('Error in loadAuditData()'));
    }
}

const getCensusAudit = async (req, res) => {
    try {
        const rows = await loadAuditData(req.params);
        res.json(rows);
    } catch (err) {
        if (err instanceof Error) {
            debug("getCensusAudit()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getCensusAudit'});
    }
}

const getCensusAuditXLSX = async (req, res) => {
    try {
        const rows = await loadAuditData(req.params);
        const audit = resultToExcelSheet(rows, {}, false);
        const workBook = buildWorkBook({audit});
        const filename = `census-audit--${req.params.minDate}_${req.params.maxDate}.xlsx`;
        const headers = buildXLSXHeaders(filename);
        Object.keys(headers).forEach(key => {
            res.setHeader(key, headers[key]);
        })
        res.send(workBook);
    } catch (err) {
        if (err instanceof Error) {
            debug("getCensusAuditXLSX()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getCensusAuditXLSX'});
    }
}

exports.getCensusAudit = getCensusAudit;
exports.getCensusAuditXLSX = getCensusAuditXLSX;
