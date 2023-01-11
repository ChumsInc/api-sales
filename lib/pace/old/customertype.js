/**
 * Created by steve on 12/14/2016.
 */
import Debug from 'debug';
import {loadCurrentInvoices, loadInvoiced} from './invoices.js';
import {loadHeldOrders, loadOpenOrders, loadPreviousOpenOrders} from './orders.js';

const debug = Debug('chums:api:sales:pace5:customerTypes');

export const loadCustomerTypes = async (params) => {
    try {
        const [invoiced, currentInvoices, prevOpenOrders, openOrders, heldOrders] = await Promise.all([
            loadInvoiced(params),
            loadCurrentInvoices(params),
            loadPreviousOpenOrders(params),
            loadOpenOrders(params),
            loadHeldOrders(params)
        ]);
        const customerTypes = {};
        [invoiced, currentInvoices, prevOpenOrders, openOrders, heldOrders].map(
            section => section.records.forEach(row => {
                const {
                    ARDivisionNo,
                    CustomerType = '',
                    InvTotal = 0,
                    OrderTotal = 0,
                    PrevOrderTotal = 0,
                    HeldOrderTotal = 0
                } = row;
                const type = `${ARDivisionNo}-${CustomerType}`;
                const existing = customerTypes[type] || {};
                customerTypes[type] = {
                    ...existing,
                    ARDivisionNo,
                    CustomerType: CustomerType || '',
                    InvTotal: InvTotal + (existing.InvTotal || 0),
                    OrderTotal: OrderTotal + (existing.OrderTotal || 0),
                    PrevOrderTotal: PrevOrderTotal + (existing.PrevOrderTotal || 0),
                    HeldOrderTotal: HeldOrderTotal + (existing.HeldOrderTotal || 0),
                };
            })
        );
        return Object.keys(customerTypes).map(key => {
            const type = customerTypes[key];
            type.Pace = (type.InvTotal || 0)
                + (type.OrderTotal || 0)
                + (type.HeldOrderTotal || 0)
                + (type.PrevOrderTotal || 0);
            return type;
        }).sort((a, b) => {
            return a.CustomerType > b.CustomerType ? 1 : -1;
        });
    } catch (err) {
        debug("loadCustomerTypes()", err.message);
        return Promise.reject(err);
    }
};
