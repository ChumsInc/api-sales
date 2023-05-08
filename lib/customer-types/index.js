import Debug from 'debug';
import {mysql2Pool} from "chums-local-modules";
const debug = Debug('chums:lib:customer-types');

async function loadCustomerTypes() {
    try {
        const sql = `SELECT ct.CustomerType, ctt.ReportAsType, ctt.Description, COUNT(c.ARDivisionNo) AS customerCount
                     FROM (
                              SELECT CustomerType
                              FROM c2.AR_CustomerType
                              UNION
                              SELECT DISTINCT CustomerType
                              FROM c2.ar_customer
                              WHERE Company = 'chums'
                                AND CustomerStatus = 'A'
                              ) ct
                          LEFT JOIN c2.AR_CustomerType ctt
                                    ON ctt.CustomerType = ct.CustomerType
                          LEFT JOIN c2.ar_customer c
                                    ON c.CustomerType = ct.CustomerType AND c.Company = 'chums' AND
                                       c.CustomerStatus = 'A'
                     GROUP BY ct.CustomerType`;
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadCustomerTypes()", err.message);
            return Promise.reject(err);
        }
        debug("loadCustomerTypes()", err);
        return Promise.reject(new Error('Error in loadCustomerTypes()'));
    }
}

async function loadCustomersByType(ARDivisionNo, CustomerType) {
    try {
        const sql = `SELECT c.Company,
                            c.ARDivisionNo,
                            c.CustomerNo,
                            CustomerName,
                            AddressLine1,
                            AddressLine2,
                            AddressLine3,
                            City,
                            State,
                            ZipCode,
                            CustomerType,
                            c.SalespersonDivisionNo,
                            c.SalespersonNo, 
                            c.DateLastActivity,
                            h.firstOrderDate,
                            h.lastOrderDate,
                            h.carts,
                            h.completed,
                            h.orders
                     FROM c2.ar_customer c
                          LEFT JOIN (
                              SELECT Company,
                                     ARDivisionNo,
                                     CustomerNo,
                                     min(h.OrderDate) as firstOrderDate,
                                     max(h.OrderDate) as lastOrderDate,
                                     sum(if(h.OrderStatus = 'Q', 1, 0)) as carts,
                                     sum(if(h.OrderStatus = 'C', 1, 0)) as completed,
                                     count(h.SalesOrderNo) as orders
                         FROM c2.SO_SalesOrderHistoryHeader h
                         WHERE h.Company = 'chums'                        
                         GROUP BY Company, ARDivisionNo, CustomerNo
                         ) h
                              using (Company, ARDivisionNo, CustomerNo)
                     WHERE c.Company = 'chums'
                       AND (ifnull(:ARDivisionNo, '') = '' OR c.ARDivisionNo = :ARDivisionNo)
                       AND (
                           (ifnull(:CustomerType, 'N/A') = 'N/A' AND c.CustomerType IS NULL)
                               OR c.CustomerType = ifnull(:CustomerType, '')
                         )
                         GROUP BY c.Company,
                                  c.ARDivisionNo,
                                  c.CustomerNo,
                                  CustomerName,
                                  AddressLine1,
                                  AddressLine2,
                                  AddressLine3,
                                  City,
                                  State,
                                  ZipCode,
                                  CustomerType,
                                  c.SalespersonDivisionNo,
                                  c.SalespersonNo,
                                  c.DateLastActivity
        `;
        const [rows] = await mysql2Pool.query(sql, {ARDivisionNo, CustomerType});
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadCustomersByType()", err.message);
            return Promise.reject(err);
        }
        debug("loadCustomersByType()", err);
        return Promise.reject(new Error('Error in loadCustomersByType()'));
    }
}

export const getCustomerTypes = async (req, res) => {
    try {
        const customerTypes = await loadCustomerTypes();
        return res.json(customerTypes);
    } catch(err) {
        if (err instanceof Error) {
            debug("getCustomerTypes()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getCustomerTypes'});
    }
}


export const getCustomersByType = async (req, res) => {
    try {
        const customers = await loadCustomersByType(req.params)
    } catch(err) {
        if (err instanceof Error) {
            debug("getCustomersByType()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getCustomersByType'});
    }
}

