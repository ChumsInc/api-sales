import Debug from "debug";
import { loadCustomizedOrders } from "./customized-orders.js";
import { loadOrderCustomizationCodes } from "./order-customization-codes.js";
import { loadOrderCardValidation } from "./validate-order-cards.js";
import { loadMOQValidation } from "./validate-moq.js";
const debug = Debug('chums:lib:audits:customization-order');
export async function getCustomizedOrderList(req, res) {
    try {
        const list = await loadCustomizedOrders();
        res.json(list);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCustomizedOrderList()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getCustomizedOrderList' });
    }
}
export async function getCustomizedOrder(req, res) {
    try {
        const salesOrderNo = req.params.salesOrderNo;
        const [salesOrder] = await loadCustomizedOrders(salesOrderNo);
        const customizedItems = await loadOrderCustomizationCodes(salesOrderNo);
        const moqValidation = await loadMOQValidation(salesOrderNo);
        const cardValidation = await loadOrderCardValidation(salesOrderNo);
        res.json({
            salesOrder,
            customizedItems,
            moqValidation,
            cardValidation
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCustomizedOrder()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getCustomizedOrder' });
    }
}
