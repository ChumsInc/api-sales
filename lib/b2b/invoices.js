import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";

const debug = Debug('chums:lib:b2b:invoices');


async function loadInvoices({ARDivisionNo, CustomerNo, userid, InvoiceNo, start = 0, limit = 500}) {
    try {
        const query = `SELECT 'chums'                               AS Company,
                              h.InvoiceNo,
                              h.InvoiceType,
                              h.InvoiceDate,
                              NULLIF(h.InvoiceDueDate, '0000-00-00') AS InvoiceDueDate,
                              h.SalesOrderNo,
                              NULLIF(h.OrderDate, '0000-00-00')      AS OrderDate,
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
                                             oi.InvoiceNo = h.InvoiceNo AND
                                             oi.InvoiceType = h.InvoiceType
                                LEFT JOIN c2.ar_termscode tc
                                          ON tc.Company = h.Company AND
                                             tc.TermsCode = h.TermsCode
                                LEFT JOIN c2.sy_user u
                                          ON u.userkey = h.UserCreatedKey
                       WHERE h.Company = 'chums'
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.CustomerNo = :CustomerNo
                         AND h.BillToDivisionNo is NULL
                         AND (:InvoiceNo IS NULL OR h.InvoiceNo = :InvoiceNo)
                         AND h.InvoiceType NOT IN ('XD')
                         AND (
                           (SELECT COUNT(*)
                            FROM users.user_AR_Customer
                            WHERE (userid = :userid OR api_id = :api_id)
                              AND Company = 'chums'
                              AND ARDivisionNo = :ARDivisionNo
                              AND CustomerNo = :CustomerNo) >= 1
                               OR h.ShipToCode IN (SELECT DISTINCT ShipToCode
                                                   FROM users.user_SO_ShipToAddress
                                                   WHERE (userid = :userid OR api_id = :api_id)
                                                     AND Company = 'chums'
                                                     AND ARDivisionNo = :ARDivisionNo
                                                     AND CustomerNo = :CustomerNo)
                           )


                       UNION
                       
                       SELECT 'chums'                               AS Company,
                              h.InvoiceNo,
                              h.InvoiceType,
                              h.InvoiceDate,
                              NULLIF(h.InvoiceDueDate, '0000-00-00') AS InvoiceDueDate,
                              h.SalesOrderNo,
                              NULLIF(h.OrderDate, '0000-00-00')      AS OrderDate,
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
                                             oi.InvoiceNo = h.InvoiceNo AND
                                             oi.InvoiceType = h.InvoiceType
                                LEFT JOIN c2.ar_termscode tc
                                          ON tc.Company = h.Company AND
                                             tc.TermsCode = h.TermsCode
                                LEFT JOIN c2.sy_user u
                                          ON u.userkey = h.UserCreatedKey
                       WHERE h.Company = 'chums'
                         AND h.BillToDivisionNo = :ARDivisionNo
                         AND h.BillToCustomerNo = :CustomerNo
                         AND (:InvoiceNo IS NULL OR h.InvoiceNo = :InvoiceNo)
                         AND h.InvoiceType NOT IN ('XD')
                         AND (
                           (SELECT COUNT(*)
                            FROM users.user_AR_Customer
                            WHERE (userid = :userid OR api_id = :api_id)
                              AND Company = 'chums'
                              AND ARDivisionNo = :ARDivisionNo
                              AND CustomerNo = :CustomerNo) >= 1
                               OR h.ShipToCode IN (SELECT DISTINCT ShipToCode
                                                   FROM users.user_SO_ShipToAddress
                                                   WHERE (userid = :userid OR api_id = :api_id)
                                                     AND Company = 'chums'
                                                     AND ARDivisionNo = :ARDivisionNo
                                                     AND CustomerNo = :CustomerNo)
                           )
                       ORDER BY InvoiceDate DESC, InvoiceNo DESC
                       LIMIT :start, :limit`;
        const api_id = userid * -1;
        const data = {userid, api_id, ARDivisionNo, CustomerNo, InvoiceNo, start: +(start ?? 0), limit: +(limit ?? 500)};

        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => ({
            ...row,
            AmountSubjectToDiscount: Number(row.AmountSubjectToDiscount),
            DiscountRate: Number(row.DiscountRate),
            DiscountAmt: Number(row.DiscountAmt),
            TaxableSalesAmt: Number(row.TaxableSalesAmt),
            NonTaxableSalesAmt: Number(row.NonTaxableSalesAmt),
            SalesTaxAmt: Number(row.SalesTaxAmt),
            FreightAmt: Number(row.FreightAmt),
            DepositAmt: Number(row.DepositAmt),
            Balance: Number(row.Balance)
        }))
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
        if (req.params.customerKey && !params.ARDivisionNo) {
            const [ARDivisionNo, CustomerNo] = req.params.customerKey.split('-');
            params.ARDivisionNo = ARDivisionNo;
            params.CustomerNo = CustomerNo;
        }
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

