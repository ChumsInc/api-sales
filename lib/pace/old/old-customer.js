/**
 * Created by steve on 12/14/2016.
 */
import Debug from 'debug';
import {loadCurrentInvoices, loadInvoiced} from './invoices.js';
import {loadHeldOrders, loadOpenOrders, loadPreviousOpenOrders} from './orders.js';
import {loadDivisions2} from '../division.js';
import {dbCompany, getDates} from '../utils.js';
import {mysql2Pool} from 'chums-base';

const debug = Debug('chums:api:sales:pace5:customer');

export async function loadB2BCustomers({company, ARDivisionNo, minDate, maxDate}) {
    try {
        const query = `SELECT DISTINCT h.Company, h.ARDivisionNo, h.CustomerNo
                       FROM c2.ar_invoicehistoryheader h
                            INNER JOIN b2b.SalesOrderLog l
                                       ON l.dbCompany = h.Company AND l.SalesOrderNo = h.SalesOrderNo
                       WHERE h.Company = :company
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.InvoiceDate BETWEEN :minDate AND :maxDate

                       UNION

                       SELECT DISTINCT h.Company, h.ARDivisionNo, h.CustomerNo
                       FROM c2.SO_SalesOrderHeader h
                            INNER JOIN b2b.SalesOrderLog l
                                       ON l.dbCompany = h.Company AND l.SalesOrderNo = h.SalesOrderNo
                       WHERE h.Company = :company
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.ShipExpireDate BETWEEN :minDate AND :maxDate
                         AND h.OrderType <> 'Q'
        `;
        const data = {company: dbCompany(company), ARDivisionNo, minDate, maxDate};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadB2BCustomers()", err.message);
        return err;
    }
}

export async function loadB2BCustomerOrders({company, ARDivisionNo, CustomerNo, minDate, maxDate}) {
    try {
        const query = `SELECT DISTINCT h.Company, h.ARDivisionNo, h.CustomerNo, h.SalesOrderNo
                       FROM c2.ar_invoicehistoryheader h
                            INNER JOIN b2b.SalesOrderLog l
                                       ON l.dbCompany = h.Company AND l.SalesOrderNo = h.SalesOrderNo
                       WHERE h.Company = :company
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.CustomerNo = :CustomerNo
                         AND h.InvoiceDate BETWEEN :minDate AND :maxDate

                       UNION

                       SELECT DISTINCT h.Company, h.ARDivisionNo, h.CustomerNo, h.SalesOrderNo
                       FROM c2.SO_SalesOrderHeader h
                            INNER JOIN b2b.SalesOrderLog l
                                       ON l.dbCompany = h.Company AND l.SalesOrderNo = h.SalesOrderNo
                       WHERE h.Company = :company
                         AND h.ARDivisionNo = :ARDivisionNo
                         AND h.CustomerNo = :CustomerNo
                         AND h.ShipExpireDate BETWEEN :minDate AND :maxDate
                         AND h.OrderType <> 'Q'
        `;
        const data = {company: dbCompany(company), ARDivisionNo, CustomerNo, minDate, maxDate};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug("loadB2BCustomers()", err.message);
        return err;
    }
}

async function loadCustomers2(params) {
    try {
        let customers = {};
        let budget = {
            budget: 0,
            goal: 0,
        };
        const paceFunctions = [
            loadInvoiced,
            loadCurrentInvoices,
            loadPreviousOpenOrders,
            loadOpenOrders,
            loadHeldOrders
        ];

        const [
            invoiced,
            currentInvoices,
            prevOpenOrders,
            openOrders,
            heldOrders
        ] = await Promise.all([
            loadInvoiced(params),
            loadCurrentInvoices(params),
            loadPreviousOpenOrders(params),
            loadOpenOrders(params),
            loadHeldOrders(params),
        ]);
        invoiced.records.forEach(({ARDivisionNo, CustomerNo, CustomerName, CreditHold, InvTotal}) => {
            customers[CustomerNo] = {ARDivisionNo, CustomerNo, CustomerName, CreditHold, InvTotal, Pace: InvTotal};
        });
        currentInvoices.records.forEach(({ARDivisionNo, CustomerNo, CustomerName, CreditHold, InvTotal}) => {
            if (!customers[CustomerNo]) {
                customers[CustomerNo] = {ARDivisionNo, CustomerNo, CustomerName, CreditHold, InvTotal, Pace: InvTotal};
            } else {
                customers[CustomerNo].InvTotal += InvTotal;
                customers[CustomerNo].Pace += InvTotal;
            }
        });
        prevOpenOrders.records.forEach(({ARDivisionNo, CustomerNo, CustomerName, CreditHold, PrevOrderTotal}) => {
            if (!customers[CustomerNo]) {
                customers[CustomerNo] = {
                    ARDivisionNo,
                    CustomerNo,
                    CustomerName,
                    CreditHold,
                    PrevOrderTotal,
                    Pace: PrevOrderTotal
                };
            } else {
                customers[CustomerNo].PrevOrderTotal = (customers[CustomerNo].PrevOrderTotal || 0) + PrevOrderTotal;
                customers[CustomerNo].Pace += PrevOrderTotal;
            }
        })
        openOrders.records.forEach(({ARDivisionNo, CustomerNo, CustomerName, CreditHold, OrderTotal}) => {
            if (!customers[CustomerNo]) {
                customers[CustomerNo] = {
                    ARDivisionNo,
                    CustomerNo,
                    CustomerName,
                    CreditHold,
                    OrderTotal,
                    Pace: OrderTotal
                };
            } else {
                customers[CustomerNo].OrderTotal = (customers[CustomerNo].OrderTotal || 0) + OrderTotal;
                customers[CustomerNo].Pace += OrderTotal;
            }
        })
        heldOrders.records.forEach(({ARDivisionNo, CustomerNo, CustomerName, CreditHold, HeldOrderTotal}) => {
            if (!customers[CustomerNo]) {
                customers[CustomerNo] = {
                    ARDivisionNo,
                    CustomerNo,
                    CustomerName,
                    CreditHold,
                    HeldOrderTotal,
                    Pace: HeldOrderTotal
                };
            } else {
                customers[CustomerNo].HeldOrderTotal = (customers[CustomerNo].HeldOrderTotal || 0) + HeldOrderTotal;
                customers[CustomerNo].Pace += HeldOrderTotal;
            }
        })

        return Object.keys(customers).map(key => customers[key]);
    } catch (err) {
        debug("loadCustomers2()", err.message);
        return err;
    }
}

export function loadCustomers(params) {
    // debug(params);
    let customers = [];
    let budget = {
        budget: 0,
        goal: 0,
    };
    const paceFunctions = [
        loadInvoiced,
        loadCurrentInvoices,
        loadPreviousOpenOrders,
        loadOpenOrders,
        loadHeldOrders
    ];
    return new Promise((resolve, reject) => {
        Promise
            .all(paceFunctions.map(fn => {
                return fn(params)
                    .then(result => {
                        // debug(result);
                        result.records.map(total => {
                            let found = false;
                            customers
                                .filter(customer => customer[result.key] === total[result.key])
                                .map(customer => {
                                    found = true;
                                    customer[result.field] = (customer[result.field] || 0) + total[result.field];
                                });
                            if (!found) {
                                customers.push(total);
                            }
                        });
                    })
            }))
            .then(() => {
                customers
                    .map(customer => {
                        customer.Pace = (customer.InvTotal || 0)
                            + (customer.OrderTotal || 0)
                            + (customer.HeldOrderTotal || 0)
                            + (customer.PrevOrderTotal || 0);
                    });

            })
            .then(() => {

            })
            .catch(err => {
                debug('loadCustomers()', err);
                reject(err);
            })
            .then(() => {
                resolve(
                    customers.sort((a, b) => {
                        // debug(a, b);
                        if ((a.PrevOrderTotal || 0) === (b.PrevOrderTotal || 0)) {
                            return b.Pace - a.Pace;
                        } else {
                            return (b.PrevOrderTotal || 0) - (a.PrevOrderTotal || 0);
                        }
                    })
                );
            });
    });
}

export function loadCustomer(params) {
    // debug(params);
    let records = [];
    let budget = {
        budget: 0,
        goal: 0,
    };
    const paceFunctions = [
        loadInvoiced,
        loadCurrentInvoices,
        loadPreviousOpenOrders,
        loadOpenOrders,
        loadHeldOrders
    ];
    return new Promise((resolve, reject) => {
        Promise
            .all(paceFunctions.map(fn => {
                return fn(params)
                    .then(result => {
                        // debug(result);
                        result.records.map(line => {
                            let found = false;
                            records
                                .filter(row => row.SalesOrderNo === line.SalesOrderNo && row.InvoiceNo === line.InvoiceNo)
                                .map(row => {
                                    row[result.field] = (row[result.field] || 0) + line[result.field];
                                    found = true;
                                });
                            if (!found) {
                                records.push(line);
                            }
                        });
                        // result.records.map(total => {
                        //     let found = false;
                        //     records
                        //         .filter(invoice => customer[result.key] === total[result.key])
                        //         .map(records => {
                        //             found = true;
                        //             invoice[result.field] = (invoice[result.field] || 0) + total[result.field];
                        //         });
                        //     if (!found) {
                        //         records.push(total);
                        //     }
                        // });
                    })
            }))
            .then(() => {
                records
                    .map(row => {
                        row.Pace = (row.InvTotal || 0)
                            + (row.OrderTotal || 0)
                            + (row.HeldOrderTotal || 0)
                            + (row.PrevOrderTotal || 0);
                    });

            })
            .then(() => {

            })
            .catch(err => {
                debug('loadCustomers()', err);
                reject(err);
            })
            .then(() => {
                resolve(
                    records.sort((a, b) => {
                        // debug(a, b);
                        if ((a.PrevOrderTotal || 0) === (b.PrevOrderTotal || 0)) {
                            return b.Pace - a.Pace;
                        } else {
                            return (b.PrevOrderTotal || 0) - (a.PrevOrderTotal || 0);
                        }
                    })
                );
            });
    });
}


export const getCustomers = async (req, res) => {
    try {
        if (!!req.params.CustomerType && req.params.CustomerType === '-') {
            req.params.CustomerType = '';
        }
        const params = {...req.params, ...getDates(req.params), totalBy: 'CustomerNo'};
        // const params = Object.assign({}, req.params, getDates(req.params), {totalBy: 'CustomerNo'});
        const [division, b2b, result] = await Promise.all([
            loadDivisions2(params),
            loadB2BCustomers(params),
            loadCustomers2(params),
        ]);

        const b2bCustomers = b2b.map(row => row.CustomerNo);
        result.forEach(row => {
            row.isB2B = b2bCustomers.includes(row.CustomerNo);
        });
        res.json({params, division, result, b2b});
    } catch (err) {
        debug("getCustomers()", err.message);
        res.json({error: err.message});
    }
}
