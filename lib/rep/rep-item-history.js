const debug = require('debug')('chums:lib:sales:rep:rep-item-history');
const {mysql2Pool} = require('chums-local-modules')
const {parseISO, formatISO9075} = require('date-fns');

const loadRepItemHistory = async ({company, salespersonDivisionNo, salespersonNo, minDate, maxDate}) => {
    try {
        const query = `SELECT h.Company,
                              h.ARDivisionNo,
                              h.CustomerNo,
                              s.ShipToCode,
                              c.CustomerName,
                              c.City,
                              c.State,
                              c.CustomerType,
                              c.CustomerName                                     AS ShipToName,
                              c.City                                             AS City,
                              c.State                                            AS State,
                              c.ZipCode                                          AS ZipCode,
                              rep.SalespersonDivisionNo,
                              rep.SalespersonNo,
                              rep.SalespersonName,
                              d.ItemCode,
                              i.ItemCodeDesc,
                              sum(d.QuantityShipped) AS QuantitySold,
                              sum(d.ExtensionAmt)                                AS DollarsSold,
                              d.UnitOfMeasure
                       FROM c2.ar_invoicehistoryheader h
                            INNER JOIN c2.ar_invoicehistorydetail d
                                       ON d.Company = h.Company
                                           AND d.InvoiceNo = h.InvoiceNo
                                           AND d.HeaderSeqNo = h.HeaderSeqNo
                            INNER JOIN c2.ar_customer c ON c.Company = h.Company AND c.ARDivisionNo = h.ARDivisionNo AND
                                                           c.CustomerNo = h.CustomerNo
                            INNER JOIN c2.ar_salesperson rep
                                       ON c.Company = rep.Company
                                           AND c.SalespersonDivisionNo = rep.SalespersonDivisionNo
                                           AND c.SalespersonNo = rep.SalespersonNo
                            INNER JOIN c2.ci_item i ON i.Company = d.Company AND i.ItemCode = d.ItemCode
                            LEFT JOIN c2.so_shiptoaddress s
                                      ON s.Company = h.Company AND s.ARDivisionNo = h.ARDivisionNo AND
                                         s.CustomerNo = h.CustomerNo AND s.ShipToCode = h.ShipToCode
                       WHERE h.Company = :company
                         AND h.InvoiceType <> 'XD'
                         AND h.InvoiceDate BETWEEN :minDate AND :maxDate
                         AND ((rep.SalespersonDivisionNo = :salespersonDivisionNo AND
                               rep.SalespersonNo = :salespersonNo)
                           OR (rep.SalesmanagerDivisionNo = :salespersonDivisionNo AND
                               rep.SalesmanagerNo = :salespersonNo))
                         AND d.ItemType = '1'
                         AND s.ShipToCode IS NULL
                       GROUP BY h.Company, h.ARDivisionNo, h.CustomerNo, d.ItemCode, d.UnitOfMeasure

                       UNION
                       SELECT h.Company,
                              h.ARDivisionNo,
                              h.CustomerNo,
                              h.ShipToCode,
                              c.CustomerName                                     AS CustomerName,
                              c.City,
                              c.State,
                              c.CustomerType,
                              s.ShipToName                                       AS ShipToName,
                              s.ShipToCity                                       AS City,
                              s.ShipToState                                      AS State,
                              s.ShipToZipCode                                    AS ZipCode,
                              rep.SalespersonDivisionNo,
                              rep.SalespersonNo,
                              rep.SalespersonName,
                              d.ItemCode,
                              i.ItemCodeDesc,
                              sum(d.QuantityShipped) AS QuantitySold,
                              sum(d.ExtensionAmt)                                AS DollarsSold,
                              d.UnitOfMeasure
                       FROM c2.ar_invoicehistoryheader h
                            INNER JOIN c2.ar_invoicehistorydetail d
                                       ON d.Company = h.Company
                                           AND d.InvoiceNo = h.InvoiceNo
                                           AND d.HeaderSeqNo = h.HeaderSeqNo
                            INNER JOIN c2.so_shiptoaddress s
                                       ON s.Company = h.Company AND s.ARDivisionNo = h.ARDivisionNo AND
                                          s.CustomerNo = h.CustomerNo AND s.ShipToCode = h.ShipToCode
                            INNER JOIN c2.ar_customer c ON c.Company = h.Company AND c.ARDivisionNo = h.ARDivisionNo AND
                                                           c.CustomerNo = h.CustomerNo
                            INNER JOIN c2.ar_salesperson rep
                                       ON s.Company = rep.Company
                                           AND s.SalespersonDivisionNo = rep.SalespersonDivisionNo
                                           AND s.SalespersonNo = rep.SalespersonNo
                            INNER JOIN c2.ci_item i ON i.Company = d.Company AND i.ItemCode = d.ItemCode
                       WHERE h.Company = :company
                         AND h.InvoiceType <> 'XD'
                         AND h.InvoiceDate BETWEEN :minDate AND :maxDate
                         AND ((rep.SalespersonDivisionNo = :salespersonDivisionNo AND
                               rep.SalespersonNo = :salespersonNo)
                           OR (rep.SalesmanagerDivisionNo = :salespersonDivisionNo AND
                               rep.SalesmanagerNo = :salespersonNo))
                         AND d.ItemType = '1'

                       GROUP BY h.Company, h.ARDivisionNo, h.CustomerNo, d.ItemCode, h.ShipToCode, d.UnitOfMeasure
                       ORDER BY Company, SalespersonDivisionNo, SalespersonNo, ARDivisionNo, CustomerNo, ShipToCode,
                                ItemCode`;
        const data = {
            company,
            salespersonDivisionNo,
            salespersonNo,
            minDate: formatISO9075(parseISO(minDate)),
            maxDate: formatISO9075(parseISO(maxDate)),
        };
        const [rows] = await mysql2Pool.query(query, data);
        rows.map(row => {
            row.QuantitySold = Number(row.QuantitySold);
            row.DollarsSold = Number(row.DollarsSold);
        });
        return rows;
    } catch (err) {
        debug("load()", err.message);
        return Promise.reject(err);
    }
};

const getRepItemHistory = async (req, res) => {
    try {
        const result = await loadRepItemHistory({...req.params});
        res.json({result});
    } catch(err) {
        debug("getRepItemHistory()", err.message);
        res.json({error: err.message});
    }
}

exports.getRepItemHistory = getRepItemHistory;

