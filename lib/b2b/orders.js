import Debug from "debug";
import {mysql2Pool} from 'chums-local-modules';

/**
 * Created by steve on 3/7/2017.
 */
const debug = Debug('chums:lib:b2b:orders');

const loadPastOrders = async ({Company, ARDivisionNo, CustomerNo, userid}) => {
    try {
        const query = `SELECT :Company    AS Company,
                              h.SalesOrderNo,
                              h.OrderDate,
                              ''          AS OrderType,
                              h.OrderStatus,
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
                              ''          AS BillToCountryName,
                              h.ShipToCode,
                              h.ShipToName,
                              h.ShipToAddress1,
                              h.ShipToAddress2,
                              h.ShipToAddress3,
                              h.ShipToCity,
                              h.ShipToState,
                              h.ShipToZipCode,
                              h.ShipToCountryCode,
                              ''          AS ShipToCountryName,
                              h.ShipVia,
                              h.CustomerPONo,
                              h.FOB,
                              h.WarehouseCode,
                              h.ConfirmTo,
                              h.Comment,
                              h.TermsCode,
                              tc.TermsCodeDesc,
                              h.LastInvoiceNo,
                              h.LastInvoiceDate,
                              h.SalespersonDivisionNo,
                              h.SalespersonNo,
                              h.PaymentType,
                              h.CancelReasonCode,
                              (h.TaxableSubjectToDiscount + h.NonTaxableSubjectToDiscount)
                                          AS AmountSubjectToDiscount,
                              h.DiscountRate,
                              h.DiscountAmt,
                              h.TaxableAmt,
                              h.NonTaxableAmt,
                              h.SalesTaxAmt,
                              h.TaxSchedule,
                              h.FreightAmt,
                              h.DepositAmt,
                              h.UserCreatedKey,
                              h.UDF_CANCEL_DATE,
                              h.UDF_IMPRINTED,
                              h.BillToDivisionNo,
                              h.BillToCustomerNo,
                              u.FirstName AS UserFirstName,
                              u.LastName  AS UserLastName,
                              h.MasterRepeatingOrderNo,
                              h.PromotedDate
                       FROM (SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_AR_Customer
                             WHERE (userid = :userid OR api_id = :api_id)
                             UNION
                             SELECT DISTINCT Company, ARDivisionNo, CustomerNo, ShipToCode
                             FROM users.user_SO_ShipToAddress
                             WHERE (userid = :userid OR api_id = :api_id)) AS a
                                INNER JOIN c2.SO_SalesOrderHistoryHeader h
                                           ON a.Company = h.Company AND a.ARDivisionNo = h.ARDivisionNo AND
                                              a.CustomerNo = h.CustomerNo AND a.ShipToCode = h.ShipToCode
                                LEFT JOIN c2.ar_termscode tc
                                          ON tc.Company = h.Company AND tc.TermsCode = h.TermsCode
                                LEFT JOIN c2.sy_user u
                                          ON u.userkey = h.UserCreatedKey
                       WHERE h.ARDivisionNo = :ARDivisionNo
                         AND h.CustomerNo = :CustomerNo
                         AND h.OrderStatus NOT IN ('A', 'Q', 'X', 'Z')
                       ORDER BY SalesOrderNo DESC`;
        const api_id = userid * -1;
        const data = {userid, api_id, Company, ARDivisionNo, CustomerNo};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            // debug('()', row);
            row.AmountSubjectToDiscount = Number(row.AmountSubjectToDiscount);
            row.DiscountRate = Number(row.DiscountRate);
            row.DiscountAmt = Number(row.DiscountAmt);
            row.TaxableAmt = Number(row.TaxableAmt);
            row.NonTaxableAmt = Number(row.NonTaxableAmt);
            row.SalesTaxAmt = Number(row.SalesTaxAmt);
            row.FreightAmt = Number(row.FreightAmt);
            row.DepositAmt = Number(row.DepositAmt);
        });
        return rows;
    } catch (err) {
        debug("loadPastOrders()", err.message);
        return Promise.reject(err);
    }
};

export const getPastOrders = async (req, res) => {
    try {
        const params = {
            ...req.params,
            userid: res.locals.profile.user.id
        };
        const list = await loadPastOrders(params);
        res.json({list});
    } catch (err) {
        debug("getPastOrders()", err.message);
        res.status(500).json({...err});
    }
};


