import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
const debug = Debug('chums:lib:commission:totals');

async function loadTotals({company, minDate, maxDate, userID}) {
    const query = `
        SELECT comm.SalespersonDivisionNo,
               comm.SalespersonNo,
               s.SalespersonName,
               IFNULL(s.UDF_TERMINATED, 'N')             AS UDF_TERMINATED,
               COUNT(DISTINCT h.InvoiceNo)               AS InvoiceCount,
               SUM(comm.InvoiceTotal)                    AS InvoiceTotal,
               SUM(comm.SalesSubjectToComm)              AS SalesSubjectToComm,
               SUM(comm.CommissionAmt)                   AS CommissionAmt,
               SUM(h.TaxableSalesAmt + h.NonTaxableSalesAmt - h.DiscountAmt) AS SalesTotal,
               SUM(h.DiscountAmt)                        AS DiscountTotal,
               SUM(comm.commissionamt)                   AS CommTotal
        FROM c2.ar_salespersoncommission comm
                 INNER JOIN c2.ar_invoicehistoryheader h
                            ON h.Company = comm.Company
                                AND h.InvoiceNo = comm.InvoiceNo
                                AND h.InvoiceType = comm.InvoiceType
                 INNER JOIN c2.ar_customer cust
                            ON cust.Company = comm.Company
                                AND cust.ARDivisionNo = comm.ARDivisionNo
                                AND cust.CustomerNo = comm.CustomerNo
                 INNER JOIN c2.ar_division d
                            ON d.Company = comm.Company
                                AND d.ARDivisionNo = comm.SalespersonDivisionNo
                 INNER JOIN c2.ar_salesperson s
                            ON s.Company = comm.Company
                                AND s.SalespersonDivisionNo = comm.SalespersonDivisionNo
                                AND s.SalespersonNo = comm.SalespersonNo
                 INNER JOIN users.accounts a
                            ON a.userid = :userID
                                AND s.Company LIKE a.Company
                                AND s.SalespersonDivisionNo LIKE a.ARDivisionNo
                                AND s.SalespersonNo LIKE a.CustomerNo
                                AND a.isRepAccount = 1 AND a.primaryAccount = 1
        WHERE comm.Company = :company
          AND comm.InvoiceDate BETWEEN :minDate AND :maxDate
          AND h.InvoiceType <> 'XD'
        GROUP BY comm.SalespersonDivisionNo, comm.SalespersonNo
    `;
    const data = {company, minDate, maxDate, userID};
    try {
         const [rows] = await mysql2Pool.query(query, data);
         rows.forEach(row => {
             row.InvoiceTotal = Number(row.InvoiceTotal);
             row.SalesSubjectToComm = Number(row.SalesSubjectToComm);
             row.CommissionAmt = Number(row.CommissionAmt);
             row.SalesTotal = Number(row.SalesTotal);
             row.CommTotal = Number(row.CommTotal);
             row.UDF_TERMINATED = row.UDF_TERMINATED === 'Y';
         })
         return rows;
    } catch(err) {
        debug("loadTotals()", err.message);
        return Promise.reject(err);
    }
}

export const getCommissionTotals = async (req, res) => {
    try {
        const userID = res.locals.profile.user.id;
        const result = await loadTotals({...req.params, userID});
        res.json({result});
    } catch(err) {
        debug("getTotals()", err.message);
        res.json({error: err.message});
    }
}
