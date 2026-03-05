import { loadRepInfo, loadRepManagers, loadRepPace, loadUserReps } from "./reps.js";
import Debug from "debug";
export { getRepPaceXLSX } from './excel-handler.js';
const debug = Debug('chums:lib:rep:pace');
export async function getRepList(req, res) {
    try {
        const userid = res.locals.profile?.user?.id ?? 0;
        const reps = loadUserReps(userid);
        res.json({ reps });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepList()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getRepList' });
    }
}
export async function getRepPace(req, res) {
    try {
        const params = {
            SalespersonDivisionNo: req.params.SalespersonDivisionNo ?? req.query.SalespersonDivisionNo,
            SalespersonNo: req.params.SalespersonNo ?? req.query.SalespersonNo,
            minDate: req.params.minDate ?? req.query.minDate,
            maxDate: req.params.maxDate ?? req.query.maxDate,
            groupByCustomer: true,
            userid: res.locals.profile.user.id,
        };
        const pace = await loadRepPace(params);
        res.json({ pace });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepPace()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getRepPace' });
    }
}
export async function getRepManagers(req, res) {
    try {
        const params = {
            SalespersonDivisionNo: req.params.SalespersonDivisionNo,
            SalespersonNo: req.params.SalespersonNo,
            userid: res.locals.profile.user.id,
        };
        const rep = await loadRepInfo(params);
        if (!rep) {
            return res.json({ rep: null });
        }
        rep.manager = await loadRepManagers({ ...rep });
        res.json({ rep });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getRepManagers()", err.message);
            return res.json({ error: err.message, name: err.name });
        }
        res.json({ error: 'unknown error in getRepManagers' });
    }
}
