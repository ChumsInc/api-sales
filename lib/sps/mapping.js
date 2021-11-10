const debug = require('debug')('chums:lib:sps:mapping');
const {mysql2Pool} = require('chums-local-modules');


/**
 *
 * @param header
 * @return {Promise<*|{}>}
 */
async function loadCustomer(header) {
    try {
        const customers = await loadCustomers();
        const [customer] = customers.filter(customer => {
            let match = true;
            customer.LookupFields
                .forEach(({field, value}) => {
                    match = match && header[field] === value;
                });
            return match;
        });
        return customer || {};
    } catch (err) {
        debug("loadCustomer()", err.message);
        return Promise.reject(err);
    }
}

exports.loadCustomer = loadCustomer;

async function loadCustomers({id, Company, ARDivisionNo, CustomerNo} = {}) {
    try {
        const query = `SELECT c.id,
                              c.Company,
                              c.ARDivisionNo,
                              c.CustomerNo,
                              ar.CustomerName,
                              c.LookupFields,
                              c.LookupValue,
                              c.options
                       FROM sps_edi.customers c
                            INNER JOIN c2.ar_customer ar
                                       USING (Company, ARDivisionNo, CustomerNo)
                       WHERE (IFNULL(:id, 0) = 0 OR c.id = :id)
                         AND (IFNULL(:CustomerNo, '') = ''
                           OR
                              (c.Company = :Company
                                  AND c.ARDivisionNo = :ARDivisionNo
                                  AND c.CustomerNo = :CustomerNo)
                           )`;

        const [rows] = await mysql2Pool.query(query, {id, Company, ARDivisionNo, CustomerNo});

        rows.forEach(row => {
            row.LookupFields = JSON.parse(row.LookupFields || '[]');
            row.LookupValue = JSON.parse(row.LookupValue || '[]');
            row.options = JSON.parse(row.options || '{}');
        });
        return rows;
    } catch (err) {
        debug("loadMappedCustomers()", err.message);
        return Promise.reject(err);
    }
}

async function saveCustomer({id, Company, ARDivisionNo, CustomerNo, lookupFields, options}) {
    try {
        if (!lookupFields || lookupFields.length === 0) {
            return Promise.reject(new Error('Invalid lookup fields'));
        }
        // ensure not changing to a duplicate customer
        const [customer] = await loadCustomers({Company, ARDivisionNo, CustomerNo});
        if (customer && (customer.id !== id || !id)) {
            return Promise.reject(new Error('That customer already exists on a different record'));
        }

        // used to update a customer entry to a new customer number
        const updateCustomerSQL = `UPDATE sps_edi.customers
                                   SET Company      = :Company,
                                       ARDivisionNo = :ARDivisionNo,
                                       CustomerNo   = :CustomerNo
                                   WHERE id = :id`;
        // used if the customer number changes but the id stays the same.
        const updateCustomerMappingSQL = `UPDATE sps_edi.mapping
                                          SET Company      = :Company,
                                              ARDivisionNo = :ARDivisionNo,
                                              CustomerNo   = :CustomerNo
                                          WHERE customerId = :id`;
        // used to update customer lookup fields
        const updateCustomerMapSQL = `UPDATE sps_edi.customers
                                      SET LookupFields = :LookupFields,
                                          options      = :options
                                      WHERE id = :id`
        // used to insert a new customer
        const insertSQL = `INSERT INTO sps_edi.customers (Company, ARDivisionNo, CustomerNo, LookupFields, options)
                           VALUES (:Company, :ARDivisionNo, :CustomerNo, :LookupFields, :options)`;
        const data = {
            id, Company, ARDivisionNo, CustomerNo,
            LookupFields: JSON.stringify(lookupFields),
            options: JSON.stringify(options || {}),
        };
        const connection = await mysql2Pool.getConnection();
        if (!id) {
            await connection.query(insertSQL, data);
        } else {
            if (!customer) {
                // ie, can't find existing mappings with that customer number, so update the customer map and elements mapping
                await connection.query(updateCustomerSQL, data);
                await connection.query(updateCustomerMappingSQL)
            }
            await connection.query(updateCustomerMapSQL, data);
        }
        connection.release();
        return loadCustomers({Company, ARDivisionNo, CustomerNo});
    } catch (err) {
        debug("saveCustomer()", err.message);
        return Promise.reject(err);
    }
}

async function loadCustomerMapping({Company, ARDivisionNo, CustomerNo}) {
    try {
        const query = `SELECT id, customerId, MapField, CSVField, CustomerValue, MappedValue, MappedOptions
                       FROM sps_edi.mapping
                       WHERE Company = :Company
                         AND ARDivisionNo = :ARDivisionNo
                         AND CustomerNo = :CustomerNo`;
        const data = {Company, ARDivisionNo, CustomerNo};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        rows.forEach(row => {
            row.MappedOptions = JSON.parse(row.MappedOptions);
        });
        return rows;
    } catch (err) {
        debug("lookupMappedValue()", err.message);
        return Promise.reject(err);
    }
}

async function addCustomerMapping({
                                      id,
                                      customerId,
                                      Company,
                                      ARDivisionNo,
                                      CustomerNo,
                                      MapField,
                                      CSVField,
                                      CustomerValue,
                                      MappedValue,
                                      MappedOptions
                                  }) {
    try {
        // if (CustomerValue === '') {
        //     return new Error('Customer item cannot be blank');
        // }
        id = Number(id) || 0;
        const query = `INSERT INTO sps_edi.mapping (customerId, Company, ARDivisionNo, CustomerNo, MapField, CSVField,
                                                    CustomerValue, MappedValue, MappedOptions)
                       VALUES (:customerId, :Company, :ARDivisionNo, :CustomerNo, :MapField, :CSVField, :CustomerValue,
                               :MappedValue, :MappedOptions)
                       ON DUPLICATE KEY UPDATE CSVField      = :CSVField,
                                               MappedValue   = :MappedValue,
                                               MappedOptions = :MappedOptions`;
        const queryUpdate = `UPDATE sps_edi.mapping
                             SET CSVField      = :CSVField,
                                 MappedValue   = :MappedValue,
                                 MappedOptions = :MappedOptions
                             WHERE id = :id`;
        const data = {
            id,
            customerId,
            Company,
            ARDivisionNo,
            CustomerNo,
            MapField,
            CSVField,
            CustomerValue,
            MappedValue,
            MappedOptions: JSON.stringify(MappedOptions),
        };
        debug('addCustomerMapping()', data);
        await mysql2Pool.query(id > 0 ? queryUpdate : query, data);
        return await loadCustomerMapping({Company, ARDivisionNo, CustomerNo});
    } catch (err) {
        debug("addCustomerMapping()", err.message);
        return Promise.reject(err);
    }
}

exports.addCustomerMapping = addCustomerMapping;

async function removeCustomerMapping({Company, ARDivisionNo, CustomerNo, id}) {
    try {
        const query = `DELETE
                       FROM sps_edi.mapping
                       WHERE Company = :Company
                         AND ARDivisionNo = :ARDivisionNo
                         AND CustomerNo = :CustomerNo
                         AND id = :id`;
        const data = {Company, ARDivisionNo, CustomerNo, id};
        const connection = await mysql2Pool.getConnection();
        await connection.query(query, data);
        connection.release();
        return await loadCustomerMapping({Company, ARDivisionNo, CustomerNo});
    } catch (err) {
        debug("removeCustomerMapping()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {string} Company
 * @param {string[]} ItemCodes
 * @return {Promise<*[]|*>}
 */
async function loadItemUnits({Company, ItemCodes = []}) {
    try {
        if (!ItemCodes.length) {
            return [];
        }
        const query = `SELECT i.ItemCode,
                              i.ItemCodeDesc,
                              i.SalesUnitOfMeasure,
                              i.SalesUMConvFctr,
                              i.StandardUnitOfMeasure,
                              i.InactiveItem,
                              i.ProductType,
                              IFNULL(bh.BillType, 'S') AS BillType
                       FROM c2.ci_item i
                            LEFT JOIN c2.BM_BillHeader bh
                                      ON bh.Company = i.company AND bh.BillNo = i.ItemCode
                       WHERE i.company = :Company
                         AND i.ItemCode IN (:ItemCodes)`;
        const data = {Company, ItemCodes};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch (err) {
        debug("loadItem()", err.message);
        return Promise.reject(err);
    }
}

async function loadBillToAddress({Company, ARDivisionNo, CustomerNo}) {
    try {
        const query = `SELECT CustomerName, AddressLine1, AddressLine2, AddressLine3, City, State, ZipCode, CountryCode
                       FROM c2.ar_customer
                       WHERE Company = :Company
                         AND ARDivisionNo = :ARDivisionNo
                         AND CustomerNo = :CustomerNo`;
        const data = {Company, ARDivisionNo, CustomerNo};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch (err) {
        debug("loadBillToAddress()", err.message);
        return Promise.reject(err);
    }
}

async function loadShipToAddress({Company, ARDivisionNo, CustomerNo, ShipToCode = '%'}) {
    try {
        const query = `SELECT ShipToCode,
                              ShipToName,
                              ShipToAddress1,
                              ShipToAddress2,
                              ShipToAddress3,
                              ShipToCity,
                              ShipToState,
                              ShipToZipCode,
                              ShipToCountryCode,
                              WarehouseCode
                       FROM c2.so_shiptoaddress
                       WHERE Company = :Company
                         AND ARDivisionNo = :ARDivisionNo
                         AND CustomerNo = :CustomerNo
                         AND ShipToCode LIKE :ShipToCode`;
        const data = {Company, ARDivisionNo, CustomerNo, ShipToCode};
        const connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(query, data);
        connection.release();
        return rows;
    } catch (err) {
        debug("loadBillToAddress()", err.message);
        return Promise.reject(err);
    }
}


exports.loadCustomers = loadCustomers;
exports.loadCustomerMapping = loadCustomerMapping;
exports.loadItemUnits = loadItemUnits;
exports.loadBillToAddress = loadBillToAddress;
exports.loadShipToAddress = loadShipToAddress;

exports.getMapping = async (req, res) => {
    try {
        const mapping = await loadCustomerMapping(req.params);
        res.json({mapping});
    } catch (err) {
        debug("getMapping()", err.message);
        res.json({error: err.message});
    }
};

exports.postMapping = async (req, res) => {
    try {
        const params = {...req.params, ...req.body};
        const mapping = await addCustomerMapping(params);
        res.json({mapping});
    } catch (err) {
        debug("postMapping()", err.message);
        res.json({error: err.message});
    }
};

exports.deleteMapping = async (req, res) => {
    try {
        const mapping = await removeCustomerMapping(req.params);
        res.json({mapping});
    } catch (err) {
        debug("postMapping()", err.message);
        res.json({error: err.message});
    }
};

exports.getCustomers = async (req, res) => {
    try {
        const customers = await loadCustomers(req.params);
        res.json({customers});
    } catch (err) {
        debug("getCustomers()", err.message);
        res.json({error: err.message});
    }
};

exports.postCustomer = async (req, res) => {
    try {
        const params = {...req.params, ...req.body};
        debug('postCustomer()', params);
        const customers = await saveCustomer(params);
        res.json({customers});
    } catch (err) {
        debug("saveCustomer()", err.message);
        res.json({error: err.message});
    }
};
