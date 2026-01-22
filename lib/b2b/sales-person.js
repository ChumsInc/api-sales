import Debug from "debug";
import { loadCondensedRepList } from "../rep/rep-list.js";
const debug = Debug('chums:lib:b2b:sales-person');
export const getRepList = async (req, res) => {
    try {
        const userId = res.locals.profile?.user?.id ?? 0;
        const list = await loadCondensedRepList({ company: 'chums', userid: userId });
        res.json({ list: list.filter(r => r.active) });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in ' });
    }
};
