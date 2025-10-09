import {mysql2Pool, ValidatedUser, buildXLSXHeaders} from 'chums-local-modules';
// import {customerItemSalesXLSX} from './render-xlsx.js'
import Debug from 'debug';
import {Request, Response} from "express";
import {LoadCustomerItemSalesProps, loadCustomerItemSalesV2} from "./db-handler.js";
import {buildCustomerItemsData, buildCustomerItemsExcel} from "./excel-handler.js";
import dayjs from "dayjs";

const debug = Debug('chums:lib:customer-item-sales');

function parseParams(req:Request, res:Response<unknown, ValidatedUser>):LoadCustomerItemSalesProps {
    const customer = (req.query.customer as string ?? '').split('-');
    const params:LoadCustomerItemSalesProps = {
        ARDivisionNo: customer[0] ?? null,
        CustomerNo: customer[1] ?? null,
        ItemCode: req.query.item as string ?? null,
        FiscalCalYear: (req.query.years as string ?? new Date().getFullYear().toString()).split(','),
        groupShipTo: req.query.combine === '1',
        userId: res.locals.profile?.user?.id ?? 0
    }
    return params;
}

export async function getCustomerItemSalesJSON(req:Request, res:Response<unknown, ValidatedUser>) {
    try {
        const params = parseParams(req, res);
        const result = await loadCustomerItemSalesV2(params);
        res.json({result: result});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getCustomerItemSales()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCustomerItemSales'});
    }

}

export async function getCustomerItemSalesData(req:Request, res:Response<unknown, ValidatedUser>) {
    try {
        const params = parseParams(req, res);
        const result = await loadCustomerItemSalesV2(params);
        const data = buildCustomerItemsData(result);
        res.json(data);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getCustomerItemSales()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCustomerItemSales'});
    }

}

export async function customerItemSalesXLSX(req:Request, res:Response<unknown, ValidatedUser>) {
    try {
        const params = parseParams(req, res);
        const result = await loadCustomerItemSalesV2(params);
        const workbook = await buildCustomerItemsExcel(result);
        if (!workbook) {
            res.status(500).json({error: 'Error building customer item sales excel'});
            return;
        }
        const timestamp = dayjs().format('YYYYMMDDHHmmss');
        let filename:string = `customer-item-sales--${timestamp}.xlsx`;
        if (params.ARDivisionNo) {
            filename = `customer-item-sales_${params.ARDivisionNo}-${params.CustomerNo}_${params.ItemCode ?? 'all'}_${params.FiscalCalYear.join('-')}_${timestamp}.xlsx`;
        } else if (params.ItemCode) {
            filename = `customer-item-sales_${params.ItemCode}_${params.FiscalCalYear.join('-')}_${timestamp}.xlsx`;
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', workbook.length);
        res.send(workbook);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("customerItemSalesXLSX()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in customerItemSalesXLSX'});
    }
}

