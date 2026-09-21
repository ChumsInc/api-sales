import {Request, Response} from "express";
import Debug from "debug";
import {loadCustomizedOrders} from "./customized-orders.js";
import {loadOrderCustomizationCodes} from "./order-customization-codes.js";
import {loadOrderCardValidation} from "./validate-order-cards.js";
import {loadMOQValidation} from "./validate-moq.js";

const debug = Debug('chums:lib:audits:customization-order');

export async function getCustomizedOrderList(req:Request, res:Response):Promise<void> {
    try {
        const list = await loadCustomizedOrders();
        res.json(list);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getCustomizedOrderList()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getCustomizedOrderList'});
    }
}

export async function getCustomizedOrder(req:Request, res:Response):Promise<void> {
    try {
        const salesOrderNo = req.params.salesOrderNo as string;
        const [salesOrder] = await loadCustomizedOrders(salesOrderNo);
        const customizedItems = await loadOrderCustomizationCodes(salesOrderNo);
        const moqValidation = await loadMOQValidation(salesOrderNo);
        const cardValidation = await loadOrderCardValidation(salesOrderNo);
        res.json({
            salesOrder,
            customizedItems,
            moqValidation,
            cardValidation
        })
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getCustomizedOrder()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getCustomizedOrder'});
    }
}
