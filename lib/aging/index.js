import Debug from 'debug';
import { loadRepAging, loadRepCustomerAging } from "./aging.js";
const debug = Debug('chums:lib:aging');
export const getAging = async (req, res) => {
    try {
        const userId = res.locals.profile?.user?.id ?? 0;
        const [salespersonDivisionNo, salespersonNo] = req.params.salespersonSlug?.split('-') ?? [];
        const args = {
            userId,
            salespersonDivisionNo: salespersonDivisionNo ?? req.params.SalespersonDivisionNo,
            salespersonNo: salespersonNo ?? req.params.SalespersonNo
        };
        const reps = await loadRepAging(args);
        const accounts = await loadRepCustomerAging(args);
        res.json({ reps, accounts });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getAging()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getAging' });
    }
};
