import dayjs from "dayjs";
import { loadRepMismatch } from "./load-orders.js";
import Debug from "debug";
const debug = Debug('chums:lib:audits:sales-order:rep-mismatch');
export const getRepMismatch = async (req, res) => {
    try {
        const orders = await loadRepMismatch();
        res.json({ orders });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepMismatch()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getRepMismatch' });
    }
};
export const renderRepMismatch = async (req, res) => {
    try {
        const list = await loadRepMismatch();
        if (!list.length) {
            res.status(204).send();
            return;
        }
        const html = await renderRepMismatchHTML(res, prepRowsForRender(list));
        res.send(html);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderRepMismatch()", err.message);
            return Promise.reject(err);
        }
        debug("renderRepMismatch()", err);
        return Promise.reject(new Error('Error in renderRepMismatch()'));
    }
};
export const renderRepMismatchEmail = async (req, res) => {
    try {
        const list = await loadRepMismatch();
        if (!list.length) {
            res.status(204).send();
            return;
        }
        const attachment = {
            content: renderRepMismatchTSV(prepRowsForRender(list)),
            filename: 'rep-mismatch.tsv',
            encoding: 'utf8',
            contentType: 'text/tab-separated-values',
        };
        const content = {
            html: await renderRepMismatchHTML(res, prepRowsForRender(list)),
            textContent: "Orders for Reps that don't match Customer Rep, see attachment",
            attachments: [attachment],
        };
        res.json(content);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("renderRepMismatchEmail()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in renderRepMismatchEmail' });
    }
};
function prepRowsForRender(rows) {
    return rows.map(row => ({
        ...row,
        OrderDate: dayjs(row.OrderDate).format('MM-DD-YYYY'),
        ShipExpireDate: dayjs(row.ShipExpireDate).format('MM-DD-YYYY'),
    }));
}
function renderRepMismatchTSV(rows) {
    return rows.map(row => {
        return [
            `${row.ARDivisionNo}-${row.CustomerNo}` + (row.ShipToCode ? `/${row.ShipToCode}` : ''),
            row.CustomerName,
            row.ShipToName ?? 'N/A',
            row.CustomerRep ?? 'N/A',
            row.SalespersonName ?? 'N/A',
            row.OrderDate,
            row.ShipExpireDate,
            row.SalesOrderRep ?? 'N/A',
            row.SalesOrderRepName ?? 'N/A',
        ].join('\t');
    }).join('\n');
}
async function renderRepMismatchHTML(res, rows) {
    return new Promise((resolve, reject) => {
        return res.render('sales/mismatch-rep-orders.pug', { orders: rows }, (err, html) => {
            if (err) {
                return reject(err);
            }
            return resolve(html);
        });
    });
}
