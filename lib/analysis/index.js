import Debug from "debug";
import { parseRequestParams } from "./parse-params.js";
import { loadResults } from "./v2/group-handler.js";
const debug = Debug('chums:lib:analysis');
export async function getSalesAnalysis(req, res) {
    const params = parseRequestParams({
        query: req.query,
        body: req.body
    });
    try {
        const result = await loadResults(params);
        res.json({ params, ...result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getSalesAnalysis()", err.message);
            const { query } = await loadResults(params, true);
            res.status(500).json({ error: err.message, name: err.name, params, query });
            return;
        }
        res.status(500).json({ error: 'unknown error in getSalesAnalysis' });
    }
}
