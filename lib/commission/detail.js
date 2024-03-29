import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
const debug = Debug('chums:lib:commission:detail');

const query = `SELECT comm.SalespersonDivisionNo,
                      comm.SalespersonNo,
                      s.SalespersonName,
                      comm.ARDivisionNo,
                      comm.CustomerNo,
                      cust.CustomerName,
                      h.BillToCity,
                      h.BillToState,
                      h.BillToCountryCode,
                      h.ShipToName,
                      h.ShipToCity,
                      h.ShipToState,
                      h.ShipToCountryCode,
                      comm.InvoiceNo,
                      comm.InvoiceType,
                      comm.InvoiceDate,
                      h.SalesOrderNo,
                      h.CustomerPONo,
                      comm.PayDate,
                      IF(comm.HasCommRecordBeenEdited, comm.CommissionRate,
                         IFNULL(NULLIF(comm.CommissionRate, 0), h.CommissionRate)) AS CommissionRate,
                      comm.InvoiceTotal,
                      comm.SalesSubjectToComm,
                      comm.CommissionAmt,
                      comm.ApplyToNo,
                      comm.SplitCommPercent,
                      h.TaxableSalesAmt + h.NonTaxableSalesAmt                     AS SalesTotal,
                      h.DiscountAmt                                                AS DiscountTotal
               FROM c2.ar_salespersoncommission comm
                        INNER JOIN c2.ar_invoicehistoryheader h
                                   ON h.Company = comm.Company
                                       AND h.InvoiceNo = comm.InvoiceNo
                                       AND h.InvoiceType = comm.InvoiceType
                        INNER JOIN c2.ar_customer cust
                                   ON cust.Company = comm.Company
                                       AND cust.ARDivisionNo = comm.ARDivisionNo
                                       AND cust.CustomerNo = comm.CustomerNo
                        INNER JOIN c2.ar_salesperson s
                                   ON s.Company = comm.Company
                                       AND s.SalespersonDivisionNo = comm.SalespersonDivisionNo
                                       AND s.SalespersonNo = comm.SalespersonNo
                        INNER JOIN users.accounts a
                                   ON a.userid = :userID
                                       AND s.Company LIKE a.Company
                                       AND s.SalespersonDivisionNo LIKE a.SalespersonDivisionNo
                                       AND s.SalespersonNo LIKE a.SalespersonNo
                                       AND a.isRepAccount = 1 AND a.primaryAccount = 1
               WHERE comm.Company = :company
                 AND comm.InvoiceDate BETWEEN :minDate AND :maxDate
                 AND comm.SalespersonDivisionNo = :SalespersonDivisionNo
                 AND comm.SalespersonNo = :SalespersonNo
                 AND h.InvoiceType <> 'XD'
               ORDER BY ARDivisionNo, CustomerNo, InvoiceNo, InvoiceType`;

async function loadRepCommissions({company, minDate, maxDate, SalespersonDivisionNo, SalespersonNo, userID}) {
    try {
        const args = {company, minDate, maxDate, SalespersonDivisionNo, SalespersonNo, userID};
        const [rows] = await mysql2Pool.query(query, args);
        rows.forEach(row => {
            row.CommissionRate = Number(row.CommissionRate);
            row.InvoiceTotal = Number(row.InvoiceTotal);
            row.SalesSubjectToComm = Number(row.SalesSubjectToComm);
            row.CommissionAmt = Number(row.CommissionAmt);
            row.SplitCommPercent = Number(row.SplitCommPercent);
            row.SalesTotal = Number(row.SalesTotal);
        })
        return rows;
    } catch (err) {
        debug("loadRepCommissions()", err.message);
        return Promise.reject(err);
    }
}

export const getRepCommissionDetail = async (req, res) => {
    try {
        const result = await loadRepCommissions({...req.params, userID: res.locals.profile.user.id});
        res.json({result});
    } catch (err) {
        debug("loadRepDetail()", err.message);
        res.json({error: err.message});
    }
}
