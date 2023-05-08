import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";

const debug = Debug('chums:lib:b2b:invoices');


async function loadInvoices({Company, ARDivisionNo, CustomerNo, userid, InvoiceNo}) {
    try {
        const query = `SELECT :Company                               AS Company,
                              h.InvoiceNo,
                              h.InvoiceType,
                              h.InvoiceDate,
                              nullif(h.InvoiceDueDate, '0000-00-00') AS InvoiceDueDate,
                              h.SalesOrderNo,
                              nullif(h.OrderDate, '0000-00-00')      AS OrderDate,
                              ''                                     AS OrderType,
                              'C'                                    AS OrderStatus,
                              h.ARDivisionNo,
                              h.CustomerNo,
                              h.BillToName,
                              h.BillToAddress1,
                              h.BillToAddress2,
                              h.BillToAddress3,
                              h.BillToCity,
                              h.BillToState,
                              h.BillToZipCode,
                              h.BillToCountryCode,
                              ''                                     AS BillToCountryName,
                              h.ShipToCode,
                              h.ShipToName,
                              h.ShipToAddress1,
                              h.ShipToAddress2,
                              h.ShipToAddress3,
                              h.ShipToCity,
                              h.ShipToState,
                              h.ShipToZipCode,
                              h.ShipToCountryCode,
                              ''                                     AS ShipToCountryName,
                              h.ShipVia,
                              h.CustomerPONo,
                              h.FOB,
                              h.WarehouseCode,
                              h.Comment,
                              h.TermsCode,
                              tc.TermsCodeDesc,
                              h.SalespersonDivisionNo,
                              h.SalespersonNo,
                              h.PaymentType,
                              h.AmountSubjectToDiscount,
                              h.DiscountRate,
                              h.DiscountAmt,
                              h.TaxableSalesAmt,
                              h.NonTaxableSalesAmt,
                              h.SalesTaxAmt,
                              h.TaxSchedule,
                              h.FreightAmt,
                              h.DepositAmt,
                              h.UserCreatedKey,
                              h.UDF_CANCEL_DATE,
                              h.BillToDivisionNo,
                              h.BillToCustomerNo,
                              u.FirstName                            AS FirstName,
                              u.LastName                             AS LastName,
                              h.EmailAddress,
                              h.UDF_PROMO_DEAL,
                              oi.Balance
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_AR_Customer
                             WHERE (userid = :userid OR api_id = :api_id)
#                             UNION
#                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
#                             FROM users.user_SO_ShipToAddress
#                             WHERE (userid = :userid OR api_id = :api_id)
                            ) AS a
                                INNER JOIN c2.ar_invoicehistoryheader h
                                           ON a.Company = h.Company
                                               AND a.ARDivisionNo = h.ARDivisionNo
                                               AND a.CustomerNo = h.CustomerNo
#                                               AND a.ShipToCode = h.ShipToCode
                                LEFT JOIN c2.AR_OpenInvoice oi
                                          ON oi.Company = h.Company AND oi.InvoiceNo = h.InvoiceNo
                                LEFT JOIN c2.ar_termscode tc
                                          ON tc.Company = h.Company AND tc.TermsCode = h.TermsCode
                                LEFT JOIN c2.sy_user u
                                          ON u.userkey = h.UserCreatedKey
                       WHERE h.Company = :Company
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.CustomerNo = :CustomerNo
                         AND (:InvoiceNo IS NULL OR h.InvoiceNo = :InvoiceNo)
                         AND h.InvoiceType NOT IN ('XD')
                       ORDER BY h.InvoiceNo DESC`;
        const api_id = userid * -1;
        const data = {userid, api_id, Company, ARDivisionNo, CustomerNo, InvoiceNo};

        const [rows] = await mysql2Pool.query(query, data);
        // debug('loadInvoices()', rows.length, {userid, Company, ARDivisionNo, CustomerNo, InvoiceNo});
        rows.forEach(row => {
            // debug('()', row);
            // row.InvoiceDueDate = row.InvoiceDueDate === '0000-00-00' ? null : new Date(row.InvoiceDueDate);
            // row.OrderDate = !!row.OrderDate ? new Date(row.OrderDate) : null;
            row.AmountSubjectToDiscount = Number(row.AmountSubjectToDiscount);
            row.DiscountRate = Number(row.DiscountRate);
            row.DiscountAmt = Number(row.DiscountAmt);
            row.TaxableSalesAmt = Number(row.TaxableSalesAmt);
            row.NonTaxableSalesAmt = Number(row.NonTaxableSalesAmt);
            row.SalesTaxAmt = Number(row.SalesTaxAmt);
            row.FreightAmt = Number(row.FreightAmt);
            row.DepositAmt = Number(row.DepositAmt);
            row.Balance = Number(row.Balance);
        });
        return rows;
    } catch (err) {
        debug("loadInvoices()", err.message);
        return Promise.reject(err);
    }
}

async function fetchInvoiceDetail({Company, InvoiceNo}) {
    try {

    } catch (err) {
        debug("fetchInvoiceDetail()", err.message);
        return err;
    }
}

export const getInvoices = (req, res) => {
    const params = {
        ...req.params,
        userid: res.locals.profile?.user?.id ?? 0
    };
    loadInvoices(params)
        .then(list => {
            res.json({list});
        })
        .catch(err => {
            res.json({error: err.message});
        })
};

