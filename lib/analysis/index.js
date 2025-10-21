import { buildSQL, execQuery } from "./db-handlers.js";
import Debug from "debug";
import { parseRequestParams } from "./parse-params.js";
const debug = Debug('chums:lib:analysis');
export async function getSalesAnalysis(req, res) {
    const params = parseRequestParams({
        query: req.query,
        body: req.body
    });
    try {
        const result = await execQuery(params);
        res.json({ params, ...result });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getSalesAnalysis()", err.message);
            const sql = await buildSQL(params);
            res.status(500).json({ error: err.message, name: err.name, params, query: sql });
            return;
        }
        res.status(500).json({ error: 'unknown error in getSalesAnalysis' });
    }
}
