import {Request, Response,} from 'express'
import Debug from "debug";
import {parseRequestParams} from "./parse-params.js";
import {SARequestParams} from "./sa-types.js";
import {loadResults} from "./v2/group-handler.js";

const debug = Debug('chums:lib:analysis');

export async function getSalesAnalysis(req: Request, res: Response) {
    const params = parseRequestParams({
        query: req.query as unknown as SARequestParams,
        body: req.body as SARequestParams
    });
    try {
        const result = await loadResults(params);
        res.json({params, ...result});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getSalesAnalysis()", err.message);
            const {query} = await loadResults(params, true);
            res.status(500).json({error: err.message, name: err.name, params, query});
            return;
        }
        res.status(500).json({error: 'unknown error in getSalesAnalysis'});
    }
}
