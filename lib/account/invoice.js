import Debug from 'debug';
import { apiFetchJSON, getDBCompany, getSageCompany, mysql2Pool, validateUserAccount } from 'chums-local-modules';
import { loadImages } from "../utils/images.js";
const debug = Debug('chums:lib:account:invoice');
async function loadInvoiceHistoryHeader({ userId, Company, InvoiceNo }) {
    try {
        const sql = `SELECT h.InvoiceNo,
                            h.HeaderSeqNo,
                            h.InvoiceType,
                            h.InvoiceDate,
                            h.SalesOrderNo,
                            h.OrderDate,
                            h.OrderType,
                            'C'                                                         AS OrderStatus,
                            h.ARDivisionNo,
                            h.CustomerNo,
                            h.TaxSchedule,
                            h.BillToName,
                            h.BillToAddress1,
                            h.BillToAddress2,
                            h.BillToAddress3,
                            h.BillToCity,
                            h.BillToState,
                            h.BillToZipCode,
                            h.BillToCountryCode,
                            h.ShipToCode,
                            h.ShipToName,
                            h.ShipToAddress1,
                            h.ShipToAddress2,
                            h.ShipToAddress3,
                            h.ShipToCity,
                            h.ShipToState,
                            h.ShipToZipCode,
                            h.ShipToCountryCode,
                            h.ShipDate,
                            h.ShipVia,
                            h.CustomerPONo,
                            h.FOB,
                            h.WarehouseCode,
                            h.TermsCode,
                            tc.TermsCodeDesc,
                            IFNULL(comm.SalespersonDivisionNo, h.SalespersonDivisionNo) AS SalespersonDivisionNo,
                            IFNULL(comm.SalespersonNo, h.SalespersonNo)                 AS SalespersonNo,
                            h.InvoiceDueDate,
                            h.DiscountDueDate,
                            h.AmountSubjectToDiscount,
                            h.DiscountAmt,
                            h.TaxableSalesAmt,
                            h.NonTaxableSalesAmt,
                            h.SalesTaxAmt,
                            h.FreightAmt,
                            h.NumberOfPackages,
                            h.UserCreatedKey,
                            h.Comment,
                            h.EmailAddress,
                            h.UDF_PROMO_DEAL,
                            h.UDF_CANCEL_DATE,
                            h.BillToDivisionNo,
                            h.BillToCustomerNo,
                            IFNULL(oi.Balance, 0)                                       AS Balance,
                            u.firstname                                                 AS FirstName,
                            u.lastname                                                  AS LastName
                     FROM c2.ar_invoicehistoryheader h
                              INNER JOIN (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                                          FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                                                FROM users.user_AR_Customer uAC
                                                WHERE (userid = :userid OR api_id = :api_id)
                                                UNION
                                                SELECT DISTINCT Company, ARDivisionNo, CustomerNo
                                                FROM users.user_SO_ShipToAddress uAC
                                                WHERE (userid = :userid OR api_id = :api_id)) a) aa
                                         ON aa.Company = h.Company AND
                                            aa.ARDivisionNo = h.ARDivisionNo AND
                                            aa.CustomerNo = h.CustomerNo
                              LEFT JOIN c2.ar_termscode tc
                                        ON tc.Company = h.Company AND
                                           tc.TermsCode = h.TermsCode
                              LEFT JOIN c2.ar_salespersoncommission comm
                                        ON comm.Company = h.Company AND
                                           comm.InvoiceNo = h.InvoiceNo AND
                                           comm.InvoiceType = h.InvoiceType
                              LEFT JOIN c2.AR_OpenInvoice oi
                                        ON oi.Company = h.Company AND oi.ARDivisionNo = h.ARDivisionNo AND
                                           oi.CustomerNo = h.CustomerNo AND oi.InvoiceNo = h.InvoiceNo AND
                                           oi.InvoiceType = h.InvoiceType
                              LEFT JOIN c2.sy_user u
                                        ON u.userkey = h.UserCreatedKey
                     WHERE h.Company = :Company
                       AND h.InvoiceNo = :InvoiceNo
                       AND h.InvoiceType <> 'XD'`;
        const args = { Company, InvoiceNo, userid: userId, api_id: +userId * -1 };
        const [rows] = await mysql2Pool.query(sql, args);
        const [invoice] = rows;
        return invoice || null;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInvoiceHeader()", err.message);
            return Promise.reject(err);
        }
        debug("loadInvoiceHeader()", err);
        return Promise.reject(new Error('Error in loadInvoiceHeader()'));
    }
}
async function loadInvoiceDetail({ Company, InvoiceNo, HeaderSeqNo, ARDivisionNo, CustomerNo }) {
    try {
        const sql = `SELECT d.DetailSeqNo,
                            d.ItemCode,
                            d.ItemType,
                            d.ItemCodeDesc,
                            d.QuantityOrdered,
                            d.QuantityShipped,
                            d.QuantityBackordered,
                            d.UnitPrice,
                            d.LineDiscountPercent,
                            d.ExtensionAmt,
                            d.PriceLevel,
                            d.KitItem,
                            d.ExplodedKitItem,
                            d.CommentText,
                            d.UnitOfMeasure,
                            d.UnitOfMeasureConvFactor,
                            i.StandardUnitPrice,
                            i.SuggestedRetailPrice,
                            d.Valuation,
                            i.UDF_UPC,
                            i.UDF_UPC_BY_COLOR,
                            i.InactiveItem,
                            i.ProductType,
                            bc.CustomerUPC
                     FROM c2.ar_invoicehistorydetail d
                              LEFT JOIN c2.ci_item i
                                        USING (Company, ItemCode)
                              LEFT JOIN (SELECT cd.ItemNumber AS ItemCode, cd.UPC AS CustomerUPC
                                         FROM barcodes.bc_customer c
                                                  INNER JOIN barcodes.bc_customerdetail cd
                                                             ON cd.CustomerID = c.id AND c.Company = :Company AND
                                                                c.ARDivisionNo = :ARDivisionNo AND
                                                                c.CustomerNo = :CustomerNo) bc
                                        ON bc.ItemCode = i.ItemCode
                     WHERE Company = :Company
                       AND InvoiceNo = :InvoiceNo
                       AND HeaderSeqNo = :HeaderSeqNo
                     ORDER BY DetailSeqNo`;
        const [rows] = await mysql2Pool.query(sql, {
            Company,
            InvoiceNo,
            HeaderSeqNo,
            ARDivisionNo,
            CustomerNo
        });
        const itemCodes = rows.filter(item => item.ItemType === '1').map(item => item.ItemCode);
        const images = await loadImages(itemCodes);
        return rows.map(row => {
            let [image] = images.filter(img => img.ItemCode === row.ItemCode).filter(img => !!img.preferred_image);
            if (!image) {
                [image] = images.filter(img => img.ItemCode === row.ItemCode);
            }
            return {
                ...row,
                QuantityOrdered: Number(row.QuantityOrdered),
                QuantityShipped: Number(row.QuantityShipped),
                QuantityBackordered: Number(row.QuantityBackordered),
                UnitPrice: Number(row.UnitPrice),
                LineDiscountPercent: Number(row.LineDiscountPercent),
                ExtensionAmt: Number(row.ExtensionAmt),
                image: image?.filename || null,
            };
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInvoiceDetail()", err.message);
            return Promise.reject(err);
        }
        debug("loadInvoiceDetail()", err);
        return Promise.reject(new Error('Error in loadInvoiceDetail()'));
    }
}
/**
 *
 * @param {string} Company
 * @param {string} InvoiceNo
 * @param {string} HeaderSeqNo
 * @return {Promise<InvoiceTrackingRecord[]>}
 */
async function loadTracking({ Company, InvoiceNo, HeaderSeqNo }) {
    try {
        const sql = `SELECT PackageNo, TrackingID, StarshipShipVia, Weight
                     FROM c2.AR_InvoiceHistoryTracking
                     WHERE Company = :Company
                       AND InvoiceNo = :InvoiceNo
                       AND HeaderSeqNo = :HeaderSeqNo`;
        const [rows] = await mysql2Pool.query(sql, {
            Company,
            InvoiceNo,
            HeaderSeqNo
        });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCommissionCorrection()", err.message);
            return Promise.reject(err);
        }
        debug("loadCommissionCorrection()", err);
        return Promise.reject(new Error('Error in loadCommissionCorrection()'));
    }
}
async function loadPDFStatus({ Company, ARDivisionNo, CustomerNo, InvoiceNo }) {
    try {
        const sql = `SELECT Directory, Filename, DateCreated, TimeCreated, Sent
                     FROM c2.AR_CustomerPDFLog
                     WHERE Company = :Company
                       AND ARDivisionNo = :ARDivisionNo
                       AND CustomerNo = :CustomerNo
                       AND DocumentKey = :InvoiceNo`;
        const [rows] = await mysql2Pool.query(sql, {
            Company,
            ARDivisionNo,
            CustomerNo,
            InvoiceNo
        });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadPDFStatus()", err.message);
            return Promise.reject(err);
        }
        debug("loadPDFStatus()", err);
        return Promise.reject(new Error('Error in loadPDFStatus()'));
    }
}
async function loadInvoicePayments({ Company, InvoiceNo, HeaderSeqNo, ARDivisionNo, CustomerNo }) {
    try {
        const sql = `SELECT PaymentSeqNo,
                            PaymentType,
                            CardType,
                            CheckNoForDeposit             AS CheckNo,
                            Last4UnencryptedCreditCardNos AS Last4,
                            TransactionAmt,
                            DateUpdated                   AS PaymentDate
                     FROM c2.AR_InvoiceHistoryPayment
                     WHERE Company = :Company
                       AND InvoiceNo = :InvoiceNo
                       AND HeaderSeqNo = :HeaderSeqNo

                     UNION

                     SELECT SequenceNo,
                            PaymentType,
                            CardType,
                            CheckNo,
                            Last4UnencryptedCreditCardNos AS Last4,
                            CashAmountApplied             AS TransactionAmt,
                            PostingDate                   AS PaymentDate
                     FROM c2.AR_CashReceiptsHistory
                     WHERE InvoiceNo = :InvoiceNo
                       AND ARDivisionNo = :ARDivisionNo
                       AND CustomerNo = :CustomerNo`;
        const [rows] = await mysql2Pool.query(sql, {
            Company,
            InvoiceNo,
            HeaderSeqNo,
            ARDivisionNo,
            CustomerNo
        });
        return rows;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInvoicePayments()", err.message);
            return Promise.reject(err);
        }
        debug("loadInvoicePayments()", err);
        return Promise.reject(new Error('Error in loadInvoicePayments()'));
    }
}
/**
 *
 * @param {string} Company
 * @param {string} InvoiceNo
 * @param {string} user
 * @param {boolean} [includeDetail]
 * @return {Promise<ExtendedInvoice>}
 */
async function loadInvoice({ Company, InvoiceNo, user, includeDetail }) {
    try {
        const sageCompany = getSageCompany(Company);
        Company = getDBCompany(Company);
        const invoice = await loadInvoiceHistoryHeader({ userId: user.id, Company, InvoiceNo });
        if (!invoice) {
            debug('loadInvoice() loading from sage', InvoiceNo);
            const json = await apiFetchJSON(`https://intranet.chums.com/node-sage/api/${sageCompany}/invoice/${InvoiceNo}`);
            return json.result;
        }
        const validation = await validateUserAccount({
            id: user.id,
            Company,
            ARDivisionNo: invoice?.ARDivisionNo,
            CustomerNo: invoice?.CustomerNo,
            ShipToCode: invoice?.ShipToCode ?? undefined,
        });
        if (!validation) {
            return Promise.reject(new Error(`User validation failed for ${invoice?.ARDivisionNo}-${invoice.CustomerNo}`));
        }
        const dataParams = {
            Company: Company,
            ARDivisionNo: invoice.ARDivisionNo,
            CustomerNo: invoice.CustomerNo,
            InvoiceNo: invoice.InvoiceNo,
            InvoiceType: invoice.InvoiceType,
            HeaderSeqNo: invoice.HeaderSeqNo,
            SalesOrderNo: invoice.SalesOrderNo,
            UserKey: invoice.UserCreatedKey,
        };
        const paperless = await loadPDFStatus(dataParams);
        const detail = await loadInvoiceDetail(dataParams);
        const tracking = await loadTracking(dataParams);
        const payments = await loadInvoicePayments(dataParams);
        return {
            ...invoice,
            Paperless: paperless,
            Detail: detail,
            Track: tracking,
            Payments: payments,
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadInvoice()", err.message);
            return Promise.reject(err);
        }
        debug("loadInvoice()", err);
        return Promise.reject(new Error('Error in loadInvoice()'));
    }
}
export const getInvoice = async (req, res) => {
    try {
        const { Company, InvoiceNo, ARDivisionNo, CustomerNo } = req.params;
        const user = res.locals.profile.user;
        const images = req.query.images ?? '';
        const invoice = await loadInvoice({ Company, InvoiceNo, user });
        res.json({ invoice });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getInvoice()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getInvoice' });
    }
};
