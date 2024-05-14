const debug = require('debug')('chums:lib:sales:rename-account');
const {mysql2Pool} = require('chums-local-modules');


const requiredRoles = ['root', 'accounting', 'admin', 'repadmin', 'customeradmin'];
const validCompanies = /^(chums|bc)$/;
const validARDivisions = {
    bc: /0[1-6]/,
    chums: /0[1-9]/
};
const validCustomer = /[A-Z]{2,3}[A-Z0-9]+/;

const logResult = async ({userID, Company, ARDivisionNo, CustomerNo, newARDivisionNo, newCustomerNo, tableName, result}) => {
    try {
        const query = `INSERT INTO c2.audit_rename_customer 
            (userID, tableName, Company, ARDivisionNo, CustomerNo, newARDivisionNo, newCustomerNo, results)
            VALUES (:userID, :tableName, :Company, :ARDivisionNo, :CustomerNo, :newARDivisionNo, :newCustomerNo, :results)`;
        const data = {
            userID, Company, ARDivisionNo, CustomerNo, newARDivisionNo, newCustomerNo, tableName,
            results: JSON.stringify(result)
        };

        await mysql2Pool.query(query, data);

    } catch (err) {
        debug('logResult', err.message);
        return Promise.reject(err);
    }
};

const performRename = async ({tableName, userID, Company, ARDivisionNo, CustomerNo, newARDivisionNo, newCustomerNo}) => {
    let connection;
    try {
        if (!tableName) {
            return Promise.reject(new Error('missing table name'));
        }

        const query = `UPDATE IGNORE ${tableName}
            SET ARDivisionNo = :newARDivisionNo, CustomerNo = :newCustomerNo
            WHERE Company = :Company and ARDivisionNo = :ARDivisionNo and CustomerNo = :CustomerNo`;
        const queryRemaining = `SELECT count(*) as remaining 
            FROM ${tableName}
            where Company = :Company and ARDivisionNo = :ARDivisionNo and CustomerNo = :CustomerNo`;
        const data = {Company, ARDivisionNo, CustomerNo, newARDivisionNo, newCustomerNo};
        connection = await mysql2Pool.getConnection();
        const [{affectedRows, changedRows}] = await connection.query(query, data);
        const [[{remaining}]] = await connection.query(queryRemaining, data);
        const result = {affectedRows, changedRows, remaining};
        connection.release();
        await logResult({userID, Company, ARDivisionNo, CustomerNo, newARDivisionNo, newCustomerNo, tableName, result});
        return {tableName, ...result};
    } catch (err) {
        if (connection) {
            connection.release();
        }
        debug('performRename', tableName, err.message);
        return Promise.reject(err);
    }
};

const performAll = async (params) => {
    try {
        if (!validCompanies.test(params.Company)) {
            return Promise.reject(new Error('Invalid Company'));
        }
        if (!validARDivisions[params.Company].test(params.newARDivisionNo)) {
            return Promise.reject(new Error('Invalid new ARDivisionNo'));
        }
        if (!validCustomer.test(params.newCustomerNo)) {
            return Promise.reject(new Error('Invalid new CustomerNo'));
        }
        debug(params);
        // return params;

        return await Promise.all([
                performRename({tableName: 'c2.ar_alternateinvoice', ...params}),
                performRename({tableName: 'c2.ar_customer_location', ...params}),
                performRename({tableName: 'c2.AR_CustomerContact', ...params}),
                performRename({tableName: 'c2.AR_CustomerCreditCard', ...params}),
                performRename({tableName: 'c2.AR_CustomerSalesHistory', ...params}),
                performRename({tableName: 'c2.AR_EDICustomer', ...params}),
                performRename({tableName: 'c2.ar_invoicehistoryheader', ...params}),
                performRename({tableName: 'c2.ar_salespersoncommission', ...params}),
                performRename({tableName: 'c2.IM_ItemTransactionHistory', ...params}),
                performRename({tableName: 'c2.SO_SalesOrderHistoryHeader', ...params}),
                performRename({tableName: 'c2.IM_ItemCustomerHistoryByPeriod', ...params}),
                performRename({tableName: 'c2.SO_ShipToAddress', ...params}),
                performRename({tableName: 'barcodes.bc_customer', ...params}),
                performRename({tableName: 'c2.ar_customer', ...params}),
            ]);
    } catch (err) {
        debug('performAll()', err.message);
        return Promise.reject(err);
    }
    
};

const rename = (req, res) => {
    const data = req.body;
    data.userID = res.locals.user.id;
    // res.json(data);
    // return;
    performAll(data)
        .then(result => {
            res.json({result});
        })
        .catch(err => {
            res.json({error: err.message});
        });
};

const validate = (req, res, next) => {
    const hasRole = requiredRoles.filter(role => res.locals.user.roles.has(role)).length > 0;
    if (!hasRole) {
        debug('router.all() Not Authorized', res.locals.user);
        debug('router.all()', requiredRoles.filter(role => res.locals.user.roles.has(role)));
        res.status(403).jsonp({error: 'Not authorized'});
        return;
    }
    next();
};

exports.validate = validate;
exports.rename = rename;

