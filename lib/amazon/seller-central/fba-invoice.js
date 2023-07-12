const debug = require('debug')('chums:lib:amazon:seller-central:fba-invoice');
const {mysql2Pool} = require('chums-local-modules');
const camelCase = require('camelcase');
const fs = require('fs').promises;
const formidable = require('formidable');
const ROOT_PATH = '/var/tmp';
const UPLOAD_PATH = ROOT_PATH + '/chums';

async function parseTextFile(filename) {
    try {
        const buffer = await fs.readFile(filename);
        await fs.unlink(filename);
        const tsv = Buffer.from(buffer).toString();
        const [header, ...rest] = tsv.trim().split('\n');
        const fields = header.split('\t').map(str => camelCase(str.trim()));
        /**
         * @type SettlementRow[]
         */
        const data = rest.map(line => {
            const row = {};
            line.split('\t').map((value, index) => {
                row[fields[index]] = value;
            });
            row.amount = Number(row.amount);
            row.quantityPurchased = Number(row.quantityPurchased);
            return row;
        });
        return data;
    } catch(err) {
        debug("parseTextFile()", err.message);
        return Promise.reject(err);
    }
}


async function handleUpload(req) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm({uploadDir: UPLOAD_PATH, keepExtensions: true});
        form.on('error', (err) => {
            debug('error', err);
            return reject(new Error(err));
        });

        form.on('aborted', () => {
            debug('aborted');
            return reject(new Error('upload aborted'));
        });

        form.parse(req, (err, fields, files) => {
            const [file] = Object.values(files);
            if (!file) {
                debug('file was not found?', file);
                return reject({error: 'file was not found'});
            }
            return resolve(file);
        })

    })
}

exports.handleUpload = handleUpload;

/**
 *
 * @param {SettlementRow[]} rows
 * @return {SettlementOrderRow[]}
 */
function parseOrder(rows) {
    /**
     *
     * @type {SettlementOrderList}
     */
    const order = {};
    /**
     * @type SettlementOrderRow
     */
    const defaultRow = {
        orderId: '',
        sku: '',
        extendedUnitPrice: 0,
        quantityPurchased: 0,
    }

    rows.forEach(row => {
        if (!row.orderItemCode) {
            return;
        }
        debug(row);
        if (!order[row.orderItemCode]) {
            order[row.orderItemCode] = {...defaultRow, orderId: row.orderId, sku: row.sku};
        }
        if (row.amountType === 'ItemPrice' && row.amountDescription === 'Principal') {
            order[row.orderItemCode].quantityPurchased = row.quantityPurchased;
        }
        order[row.orderItemCode].extendedUnitPrice += row.amount;
    });

    return Object.values(order);
}

exports.postFBAInvoice = async (req, res) => {
    try {
        const file = await handleUpload(req);
        debug('testCSVFile()', file.path);

        const data = await parseTextFile(file.path);
        debug('postFBAInvoice()', data.length);
        const salesOrder = parseOrder(data);

        res.json({salesOrder, data});
    } catch (err) {
        debug("test()", err.message);
        res.json({error: err.message})
    }
};

