import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";

const debug = Debug('chums:lib:b2b:invoices');


async function loadInvoices({Company, ARDivisionNo, CustomerNo, userid, InvoiceNo, start = 0, limit = 500}) {
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
                       FROM c2.ar_invoicehistoryheader h                   
                                LEFT JOIN c2.AR_OpenInvoice oi
                                          ON oi.Company = h.Company AND
                                             oi.ARDivisionNo = h.ARDivisionNo AND
                                             oi.CustomerNo = h.CustomerNo AND
                                             oi.InvoiceNo = h.InvoiceNo and
                                             oi.InvoiceType = h.InvoiceType
                                LEFT JOIN c2.ar_termscode tc
                                          ON tc.Company = h.Company AND 
                                             tc.TermsCode = h.TermsCode
                                LEFT JOIN c2.sy_user u
                                          ON u.userkey = h.UserCreatedKey
                       WHERE h.Company = :Company
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.CustomerNo = :CustomerNo
                         AND (:InvoiceNo IS NULL OR h.InvoiceNo = :InvoiceNo)
                         AND h.InvoiceType NOT IN ('XD')
                         AND (
                           (SELECT count(*)
                            FROM users.user_AR_Customer
                            WHERE (userid = :userid OR api_id = :api_id)
                              AND Company = :Company
                              AND ARDivisionNo = :ARDivisionNo
                              AND CustomerNo = :CustomerNo) >= 1
                               OR h.ShipToCode in (SELECT DISTINCT ShipToCode
                                                   FROM users.user_SO_ShipToAddress
                                                   WHERE (userid = :userid OR api_id = :api_id)
                                                     AND Company = :Company
                                                     AND ARDivisionNo = :ARDivisionNo
                                                     AND CustomerNo = :CustomerNo)
                           )
                       ORDER BY h.InvoiceDate DESC, h.InvoiceNo DESC
                       LIMIT :start, :limit`;
        const api_id = userid * -1;
        const data = {userid, api_id, Company, ARDivisionNo, CustomerNo, InvoiceNo, start: +(start ?? 0), limit: +(limit ?? 500)};

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

export const getInvoices = async (req, res) => {
    try {
        const start = +(req.query.start ?? 0);
        const limit = +(req.query.limit ?? 500);

        const params = {
            ...req.params,
            userid: res.locals.profile?.user?.id ?? 0,
            start,
            limit,
        };
        const list = await loadInvoices(params);
        res.json({list});
    } catch(err) {
        if (err instanceof Error) {
            debug("getInvoices()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getInvoices'});
    }
};

