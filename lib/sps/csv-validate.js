const debug = require('debug')('chums:lib:sps:csv-validate');
const fs = require('fs').promises;
const {handleUpload} = require('./upload');
const {
    loadCustomers,
    loadCustomer,
    loadCustomerMapping,
    loadItemUnits,
    loadBillToAddress,
    loadShipToAddress
} = require('./mapping');
const {parse, addBusinessDays} = require('date-fns');
const {updateCustomHeader, updateCustomDetail} = require('./csv-customization');
const {mysql2Pool} = require("chums-local-modules");

function isObject(a) {
    return (!!a) && (a.constructor === Object);
}

/**
 *
 * @type {EDISalesOrder}
 */
const defaultSalesOrder = {
    Company: 'chums',
    ARDivisionNo: '',
    CustomerNo: '',
    CustomerPONo: '',
    ShipExpireDate: '',
    CancelDate: '',
    ShipToCode: '',
    WarehouseCode: '000',
};

/**
 * Parse a SPS Date, and optionally add X business days
 * @param value
 * @param {number|Object} addDays
 * @return {null|Date}
 */
const parseSPSDate = (value = '', addDays = 0) => {
    if (value === '') {
        return null;
    }
    if (isObject(addDays) && typeof addDays.add === "number") {
        addDays = addDays.add;
    }
    if (/ - /.test(value)) {
        const values = value.split(' - ');
        if (values.length === 2) {
            value = values[0].trim();
        }
    }
    const date = parse(value, 'MM/dd/yyyy', new Date());
    if (addDays !== 0) {
        return addBusinessDays(date, addDays);
    }
    return date;
};

/**
 *
 * @param {string} csv
 * @return {Promise<CSVLine[]>}
 */
async function parseCSV(csv = '') {
    try {
        const [header, ...rest] = csv.trim().split('\n');
        const fields = header.split(',').map(str => str.trim());
        return rest
            .map((line, _index) => {
                const row = {_index};
                line.split(',')
                    .forEach((value, index) => {
                        row[fields[index]] = value;
                    });
                return row;
            });
    } catch(err) {
        debug("parseCSV()", err.message);
        return Promise.reject(err);
    }
}
/**
 *
 * @param {string} filename
 * @return {Promise<CSVLine[]>}
 */
async function parseFile(filename) {
    try {
        const buffer = await fs.readFile(filename);
        const csv = Buffer.from(buffer).toString();
        return parseCSV(csv);
    } catch (err) {
        debug("parseFile()", err.message);
        return Promise.reject(err);
    }
}

exports.parseFile = parseFile;

/**
 *
 * @param {string} filename
 * @return {Promise<never>}
 */
async function removeFile(filename) {
    try {
        await fs.unlink(filename);
    } catch (err) {
        debug("removeFile()", err.message);
        return Promise.reject(err);
    }
}

async function convertHeader({Company, ARDivisionNo, CustomerNo}, headerLine) {
    try {

    } catch (err) {
        debug("convertHeader()", err.message);
        return Promise.reject(err);
    }
}

function filterCustomer(customers, header) {
    return customers
        .filter(customer => {
            const values = customer.LookupFields.map(field => header[field]);
            return JSON.stringify(values) === JSON.stringify(customer.LookupValue);
        });
}

/**
 * returns a mapped value given a lookup field and customer value,
 * for example ShipToCode, 60001, "Ship To Location",  => {... MappedValue: 6000}
 * @param {Object} line
 * @param {Array} mapping
 * @param {string} field
 * @param {string} defaultCSVField
 * @return {*|{CustomerValue: *, CSVField: *, MappedValue: *, MapField: *, MappedOptions: *}}
 */

function getMapping(line, mapping = [], field, defaultCSVField) {
    const [map] = mapping
        .filter(map => map.MapField === field)
        .filter(map => map.CustomerValue === line[map.CSVField]);
    return map || {
        id: 0,
        MapField: field,
        CSVField: defaultCSVField,
        CustomerValue: line[defaultCSVField],
        MappedValue: line[defaultCSVField],
        MappedOptions: {},
    };
}

/**
 * returns a mapped field (and additional data) given a lookup field,
 * for example ShipExpireDate => {... CSVField: 'PO Date', CustomerValue: line[map.CSVField], MappedValue: {add: 7}}
 * @param line
 * @param mapping
 * @param field
 * @param defaultCSVField
 * @return {*|{CustomerValue: *, CSVField: *, MappedValue: *, MapField: *}}
 */
function getMappedField(line, mapping, field, defaultCSVField) {
    const [map] = mapping
        .filter(map => map.MapField === field)
        .map(map => {
            map.CustomerValue = line[map.CSVField];
            return map;
        });
    return map || {
        MapField: field,
        CSVField: defaultCSVField,
        CustomerValue: line[defaultCSVField],
        MappedValue: line[defaultCSVField],
        MappedOptions: {},
    };
}


/**
 *
 * @param lines
 * @return {Promise<{SalesOrder: EDISalesOrder, mapping: EDIMapping[], ItemCodes, unitsOfMeasure: (*[]|*), customer: (*|{})}|*>}
 */
async function convertToOrder(lines) {
    try {
        const [header] = lines.filter(line => line['Record Type'] === 'H');
        if (!header) {
            return Promise.reject(new Error('Cannot process order: header is missing'));
        }
        const detail = lines.filter(line => line['Record Type'] === 'D');
        if (!detail.length) {
            return Promise.reject(new Error('Cannot process order: detail is missing'));
        }

        const comments = [
            lines.filter(line => line['Record Type'] === 'H').map(line => line['Notes/Comments']).join(' '),
            lines.filter(line => line['Record Type'] === 'O').map(line => line['Notes/Comments']).join(' '),
            lines.filter(line => line['Record Type'] === 'N').map(line => line['Notes/Comments']).join(' '),
        ].filter(line => !!line);


        const customer = await loadCustomer(header);

        /**
         *
         * @type {EDIMapping[]}
         */
        let mapping = [];
        const so = {...defaultSalesOrder};

        if (customer && !!customer.ARDivisionNo) {
            const {Company, ARDivisionNo, CustomerNo, options} = customer;
            mapping = await loadCustomerMapping({Company, ARDivisionNo, CustomerNo});
            so.Company = Company;
            so.ARDivisionNo = ARDivisionNo;
            so.CustomerNo = CustomerNo;
            so.zeroCommissions = options.zeroCommissions === true;
        }
        so.CustomerPONo = header['PO Number'];

        const ShipExpireMapping = getMappedField(header, mapping, 'ShipExpireDate', 'Ship Dates');
        so.ShipExpireDate = parseSPSDate(ShipExpireMapping.CustomerValue, ShipExpireMapping.MappedOptions)
            || new Date();

        const CancelDateMapping = getMappedField(header, mapping, 'CancelDate', 'Cancel Date');
        so.CancelDate = parseSPSDate(CancelDateMapping.CustomerValue, CancelDateMapping.MappedOptions)
            || '';

        so.ShipToCode = getMapping(header, mapping, 'ShipToCode', 'Ship To Location').MappedValue;

        const [BillToAddress] = await loadBillToAddress(so);
        so.BillToAddress = BillToAddress || {};

        so.DropShip = false;
        if (header['PO Type'] && header['PO Type'] === 'Direct Ship') {
            so.DropShip = true;
            so.ShipToAddress = {
                ShipToCode: '',
                ShipToName: header['Ship To Name'],
                ShipToAddress1: header['Ship To Address 1'],
                ShipToAddress2: header['Ship To Address 2'],
                ShipToCity: header['Ship To City'],
                ShipToState: header['Ship To State'],
                ShipToZipCode: header['Ship to Zip'],
                ShipToCountryCode: header['Ship To Country'],
            };
            if (!!header['Ship To Additional Name'] && header['Ship To Additional Name'].trim() !== '') {
                so.ShipToAddress.ShipToAddress3 = so.ShipToAddress.ShipToAddress2;
                so.ShipToAddress.ShipToAddress2 = so.ShipToAddress.ShipToAddress1;
                so.ShipToAddress.ShipToAddress1 = header['Ship To Additional Name']
            }
            so.CarrierCode = header['Carrier'];
            so.ShipVia = getMapping(header, mapping, 'ShipVia', 'Carrier Details').MappedValue;
        } else {
            const [ShipToAddress = {}] = await loadShipToAddress(so);
            so.ShipToAddress = ShipToAddress;
            so.WarehouseCode = ShipToAddress.WarehouseCode || so.WarehouseCode;
            if (ShipToAddress.ShipToCode !== so.ShipToCode) {
                // so.mappedShipToCode = so.ShipToCode;
                // so.ShipToCode = '';
            }
        }


        const ItemCodes = detail.map(line => getMapping(line, mapping, 'ItemCode', 'Vendor Style').MappedValue)
            .reduce((pv, cv) => (pv.includes(cv) ? pv : [...pv, cv]), []);
        const unitsOfMeasure = await loadItemUnits({Company: so.Company || 'chums', ItemCodes});

        so.detail = detail.map(csv => {
            const map = getMapping(csv, mapping, 'ItemCode', 'Vendor Style');
            const VendorStyle = map.CustomerValue || csv['Vendor Style'];
            const QuantityOrdered = Number(csv['Qty per Store #']) || Number(csv['Qty Ordered']) || 0;
            const UnifOfMeasure = csv['Unit of Measure'];
            const StoreNo = csv['Store #'];
            // debug('so.detail()', {map});
            const ItemCode = map.MappedValue;
            const {conversionFactor = 1, UOMOverride = ''} = map.MappedOptions || {};
            const row = {
                _index: csv._index,
                VendorStyle,
                ItemCode: ItemCode,
                ItemCodeDesc: csv['Product/Item Description'] || map.CustomerValue,
                QuantityOrdered: QuantityOrdered,
                UnitOfMeasure: UnifOfMeasure,
                UnitPrice: Number(csv['Unit Price']),
                CommentText: csv['Notes/Comments'],
                UDF_SHIP_CODE: StoreNo || null,
                errors: [],
                csv,
                map,
            };
            if (String(UOMOverride || '') !== '') {
                row.UnitOfMeasure = UOMOverride;
            }
            if (conversionFactor < 1) {
                row.QuantityOrdered *= conversionFactor;
                row.UnitPrice /= conversionFactor;
            } else if (conversionFactor > 1 && row.QuantityOrdered % conversionFactor === 0) {
                row.QuantityOrdered /= conversionFactor;
                row.UnitPrice *= conversionFactor;
            } else if (conversionFactor > 1 && row.QuantityOrdered % conversionFactor !== 0) {
                row.errors.push(`Invalid conversion factor in ${ItemCode}: ${row.QuantityOrdered} / ${conversionFactor} = ${row.QuantityOrdered / conversionFactor}`);
            }
            // if (conversionFactor !== 0 && QuantityOrdered % conversionFactor === 0 && conversionFactor !== 1) {
            //     row.QuantityOrdered /= conversionFactor;
            //     row.UnitPrice *= conversionFactor;
            // } else if (conversionFactor === 0 || QuantityOrdered % conversionFactor !== 0) {
            //     row.errors.push('Invalid conversion factor in ' + ItemCode);
            // }

            const [unitMap] = unitsOfMeasure.filter(item => item.ItemCode === ItemCode);

            if (unitMap) {
                if (unitMap.InactiveItem === 'Y') {
                    row.errors.push(`Item '${ItemCode}' is inactive.`);
                } else if (unitMap.ProductType === 'D') {
                    row.errors.push(`Item '${ItemCode}' is discontinued.`);
                } else if (unitMap.BillType === 'I') {
                    row.errors.push(`Item '${ItemCode}' has an invalid Bill of Materials - See Laura.`);
                } else {
                    row.ItemCodeDesc = unitMap.ItemCodeDesc;
                    // row.unitMap = unitMap;
                    if (row.UnitOfMeasure === UnifOfMeasure && unitMap.SalesUMConvFctr !== 0 && row.QuantityOrdered % unitMap.SalesUMConvFctr === 0) {
                        row.QuantityOrdered /= unitMap.SalesUMConvFctr;
                        row.UnitPrice *= unitMap.SalesUMConvFctr;
                        row.UnitOfMeasure = unitMap.SalesUnitOfMeasure;
                    }
                }
            } else {
                // row.ItemCode = '-';
                row.errors.push(`Item not found: ${ItemCode} - please map to a valid item.`);
            }
            return {...row, ...updateCustomDetail(customer, row, csv)};
        });

        so.comments = comments;
        const SalesOrder = {...so, ...updateCustomHeader(customer, so, header)};
        return {
            SalesOrder,
            mapping,
            customer,
            unitsOfMeasure,
            ItemCodes,
        };
    } catch (err) {
        debug("convertToOrder()", err.message, err.toString());
        return err;
    }
}

/**
 *
 * @param {string} filename
 * @param {EDISalesOrder} order
 * @param {number} user_id
 * @return {Promise<never>}
 */
async function logCSVOrder(filename, order, user_id) {
    try {
        const {Company, ARDivisionNo, CustomerNo, CustomerPONo} = order;
        if (!Company || !ARDivisionNo || !CustomerNo) {
            return;
        }
        const buffer = await fs.readFile(filename);
        const csv = Buffer.from(buffer).toString();
        const sql = `INSERT IGNORE INTO sps_edi.csvImportLog (Company, ARDivisionNo, CustomerNo, CustomerPONo, user_id, data)
                     VALUES (:Company, :ARDivisionNo, :CustomerNo, :CustomerPONo, :user_id, :data)`;
        const args = {
            Company,
            ARDivisionNo,
            CustomerNo,
            CustomerPONo,
            user_id,
            data: csv,
        }
        await mysql2Pool.query(sql, args);
    } catch (err) {
        debug("logCSVOrder()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {number} id
 * @return {Promise<CSVLine[]>}
 */
async function loadCSVFromLog(id) {
    try {
        const sql = `SELECT data from sps_edi.csvImportLog where id = :id`;
        const [rows] = await mysql2Pool.query(sql, {id});
        if (!rows.length) {
            return Promise.reject(new Error(`CSV Log record ${id} does not exist`));
        }
        return await parseCSV(rows[0].data);
    } catch(err) {
        debug("loadCSVFromLog()", err.message);
        return Promise.reject(err);
    }
}

exports.testCSVFile = async (req, res) => {
    try {
        const file = await handleUpload(req);
        const csvLines = await parseFile(file.path);
        const result = await convertToOrder(csvLines);
        await logCSVOrder(file.path, result.SalesOrder, res.locals.profile.user.id);
        await removeFile(file.path)
        res.json({...result, csvLines});
    } catch (err) {
        debug("test()", err.message);
        res.json({error: err.message})
    }
};

exports.testExistingCSVFile = async (req, res) => {
    try {
        const csvLines = await loadCSVFromLog(req.params.id);
        const result = await convertToOrder(csvLines);
        res.json({...result, csvLines});
    } catch(err) {
        debug("testExistingCSVFile()", err.message);
        return Promise.reject(err);
    }
}
