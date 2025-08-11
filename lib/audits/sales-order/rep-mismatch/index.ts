import type {Request, Response} from "express";
import type {MailerMultiPartContent} from "chums-types";
import dayjs from "dayjs";
import {loadRepMismatch} from "./load-orders.js";
import Debug from "debug";
import type {RepMismatchRecord} from "./types.js";
import type {Attachment} from 'nodemailer/lib/mailer/index.js';

const debug = Debug('chums:lib:audits:sales-order:rep-mismatch');


export const getRepMismatch = async (req: Request, res: Response): Promise<void> => {
    try {
        const orders = await loadRepMismatch();
        res.json({orders})
    } catch (err) {
        if (err instanceof Error) {
            debug("getRepMismatch()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getRepMismatch'});
    }
}

export const renderRepMismatch = async (req: Request, res: Response): Promise<void> => {
    try {
        const list = await loadRepMismatch();
        if (!list.length) {
            res.status(204).send();
            return;
        }
        const html = await renderRepMismatchHTML(res, prepRowsForRender(list));
        res.send(html);
    } catch (err) {
        if (err instanceof Error) {
            debug("renderRepMismatch()", err.message);
            return Promise.reject(err);
        }
        debug("renderRepMismatch()", err);
        return Promise.reject(new Error('Error in renderRepMismatch()'));
    }
}

export const renderRepMismatchEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const list = await loadRepMismatch();
        if (!list.length) {
            res.status(204).send();
            return;
        }
        const attachment:Attachment = {
            content: renderRepMismatchTSV(prepRowsForRender(list)),
            filename: 'rep-mismatch.tsv',
            encoding: 'utf8',
            contentType: 'text/tab-separated-values',

        }
        const content:MailerMultiPartContent = {
            html: await renderRepMismatchHTML(res, prepRowsForRender(list)),
            textContent: "Orders for Reps that don't match Customer Rep, see attachment",
            attachments: [attachment],
        }
        res.json(content);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("renderRepMismatchEmail()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in renderRepMismatchEmail'});
    }

}

function prepRowsForRender(rows:RepMismatchRecord[]):RepMismatchRecord[] {
    return rows.map(row => ({
        ...row,
        OrderDate: dayjs(row.OrderDate).format('MM-DD-YYYY'),
        ShipExpireDate: dayjs(row.ShipExpireDate).format('MM-DD-YYYY'),
    }))
}

function renderRepMismatchTSV(rows:RepMismatchRecord[]):string {
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


async function renderRepMismatchHTML(res:Response, rows:RepMismatchRecord[]):Promise<string> {
    return new Promise((resolve, reject) => {
        return res.render('sales/mismatch-rep-orders.pug', {orders: rows}, (err, html) => {
            if (err) {
                return reject(err);
            }
            return resolve(html);
        })
    })
}
