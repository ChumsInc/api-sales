import Debug from "debug";
import { execRenumberCustomer } from "./table-handlers.js";
import { validateCustomerRename } from "./utils.js";
const debug = Debug('chums:lib:utils:renumber-customer:table-handlers');
export async function postRenumberCustomer(req, res) {
    try {
        const { from, to } = req.params;
        let dryRun = req.method.toLowerCase() !== 'post';
        const userId = res.locals.profile?.user?.id ?? 0;
        const fromCustomer = await validateCustomerRename(from);
        const toCustomer = await validateCustomerRename(to);
        const result = await execRenumberCustomer(userId, from, to, { dryRun });
        res.json({
            from: fromCustomer,
            to: toCustomer,
            dryRun,
            result
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postRenumberCustomer()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in postRenumberCustomer' });
    }
}
