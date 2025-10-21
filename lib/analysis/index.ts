import {Request, Response,} from 'express'
import {buildSQL, execQuery} from "./db-handlers.js";
import Debug from "debug";
import {parseRequestParams} from "./parse-params.js";
import {SARequestParams} from "./sa-types.js";

const debug = Debug('chums:lib:analysis');

export async function getSalesAnalysis(req: Request, res: Response) {
    const params = parseRequestParams({
        query: req.query as unknown as SARequestParams,
        body: req.body as SARequestParams
    });
    try {
        const result = await execQuery(params);
        res.json({params, ...result});
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getSalesAnalysis()", err.message);
            const sql = await buildSQL(params);
            res.status(500).json({error: err.message, name: err.name, params, query: sql});
            return;
        }
        res.status(500).json({error: 'unknown error in getSalesAnalysis'});
    }
}

