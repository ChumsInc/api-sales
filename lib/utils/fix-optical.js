import Debug from 'debug';
import { mysql2Pool } from "chums-local-modules";
const debug = Debug('chums:lib:utils:fix-optical');
const customers = [
    "01-WI0046",
    "01-CA1019", // ar_alternateinvoice
    "01-MD0024",
    "01-CA0630",
    "01-WI705",
    "01-FL0277",
    "01-NC0193",
    "01-UT0382",
    "01-AR0073",
    "01-CA1032",
    "01-IL0074",
    "01-UT0168",
    "01-CO0296",
    "01-IN0016",
    "01-CO0418",
    "01-RI0039",
    "01-CA0365",
    "01-UT0132",
    "01-NC0346",
    "01-FL0124",
    "01-NV0027",
    "01-NC0171",
    "01-TN0131",
    "01-SD0018",
    "01-UT0345",
    "01-ID0136",
    "01-AZ0201",
    "01-UT0245",
    "01-NY0153",
    "01-CA1297",
    "01-MT1227",
    "01-NY0162",
    "01-CT0065",
    "01-MS0032",
    "01-FL0624",
    "01-CA0950",
    "01-NY0188",
    "01-CO0357",
    "01-UT200",
    "01-UT0170",
    "01-CA1616",
    "01-UT0341",
    "01-CA0700",
    "01-FL0006",
    "01-UT0558",
    "01-NJ0255",
    "01-WY0046",
    "01-UT0411",
    "01-WA0086",
    "01-MD0053",
    "01-LA0110",
    "01-NY966",
    "01-OH0096",
    "01-GA0134",
    "01-WA0094",
    "01-GA0059",
    "01-CA0859",
    "01-CA1182",
    "01-CA1140",
    "01-NJ0165",
    "01-MT0067",
    "01-SC0156",
    "01-TX0410",
    "01-WA0093",
    "01-CA1349",
    "01-CA0844",
    "01-CA0241",
    "01-CA0415",
    "01-OR7006",
    "01-MN0057",
    "01-NY0157",
    "01-CA0693",
    "01-UT0355",
    "01-ID0067",
    "01-TN0090",
    "01-MT0182",
    "01-SC0129",
    "01-NV0061",
    "01-AZ0119",
    "01-MA0186",
    "01-CO0470",
    "01-NC0267",
    "01-CA0967",
    "01-NV0020",
    "01-NY7561",
    "01-AZ0103",
    "01-SC0128",
    "01-OR2929",
    "01-NY0187",
    "01-FL0585",
    "01-CA1309",
    "01-MI0033",
    "08-NY0064",
    "01-ID0200",
    "01-KY0026",
    "01-WV0048",
    "01-NY0107",
    "01-ID0214",
    "01-MT0020",
    "01-GA0237",
    "01-NY0209",
    "01-NC0350",
    "01-WI0052",
    "05-CA0678",
    "01-UT660",
    "01-CA7077",
    "01-NY0200",
    "01-OR0159",
    "01-CA0975",
    "01-HI0068",
    "01-FL0432",
    "01-NJ0124",
    "01-CA1070",
    "01-UT0388",
    "01-UT100",
    "01-CA0919",
    "01-CA1031",
    "01-CA0913",
    "01-CA1466",
    "01-UT0255",
    "01-MI0080",
    "01-SC0209",
    "01-WI0112",
    "01-IL0083",
    "01-OR0241",
    "01-NV0105",
    "01-AR0048",
    "01-LA0077",
    "01-OK0023",
    "01-VA0138",
    "01-OK0018",
    "01-PA0158",
    "01-KS0006",
    "01-TX0171",
    "01-OR0158",
    "01-WI0089",
];
const tables = [
    'c2.ar_alternateinvoice',
    'c2.ar_customer_location',
    'c2.AR_CustomerContact',
    'c2.AR_CustomerCreditCard',
    'c2.AR_CustomerSalesHistory',
    'c2.AR_EDICustomer',
    'c2.ar_invoicehistoryheader',
    'c2.ar_salespersoncommission',
    'c2.IM_ItemTransactionHistory',
    'c2.SO_SalesOrderHistoryHeader',
    'c2.IM_ItemCustomerHistoryByPeriod',
    'c2.SO_ShipToAddress',
    'barcodes.bc_customer',
    'c2.ar_customer'
];
const deleteOnExisting = [
    'c2.ar_customer_location',
    'c2.AR_CustomerContact',
    'c2.AR_CustomerCreditCard',
];
async function checkExistingRows() {
    try {
        const sql = `SELECT count(*) as remaining 
            FROM :table
            where Company = 'chums' 
              and ARDivisionNo = :arDivisionNo 
              and CustomerNo = :customerNo`;
        const response = {};
        for await (const c of customers.slice(0, 10)) {
            const [arDivisionNo, customerNo] = c.split('-');
            response[c] = {};
            for await (const t of tables) {
                const _sql = sql.replace(':table', t);
                const [rows] = await mysql2Pool.query(_sql, { arDivisionNo, customerNo });
                if (rows[0]?.remaining > 0) {
                    response[c][t] = rows[0].remaining;
                }
            }
        }
        return response;
    }
    catch (err) {
        if (err instanceof Error) {
            debug("checkExistingRows()", err.message);
            return Promise.reject(err);
        }
        debug("checkExistingRows()", err);
        return Promise.reject(new Error('Error in checkExistingRows()'));
    }
}
export const getExistingOpticalRows = async (req, res) => {
    try {
        const response = await checkExistingRows();
        res.json(response);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getExistingRows()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getExistingRows' });
    }
};
async function checkARCustomerSalesHistory(customerNo) {
    const sql = `SELECT *
                 FROM c2.AR_CustomerSalesHistory
                 WHERE Company = 'chums'
                   AND ARDivisionNo = :arDivisionNo
                   AND CustomerNo = :customerNo`;
}
