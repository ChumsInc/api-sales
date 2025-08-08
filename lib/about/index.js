import { readFile } from 'node:fs/promises';
import Debug from 'debug';
import process from "node:process";
import dayjs from "dayjs";
import duration from 'dayjs/plugin/duration.js';
dayjs.extend(duration);
const debug = Debug('chums:lib:about');
async function loadVersion() {
    let version = '';
    try {
        const contents = await readFile('./package.json');
        if (contents) {
            const json = JSON.parse(contents.toString());
            version = json?.version ?? 'unknown version';
        }
    }
    catch (err) {
        if (err instanceof Error) {
            version = err.message;
        }
        else {
            version = 'error in aboutAPI';
        }
    }
    return version;
}
export const aboutAPI = async (req, res) => {
    try {
        const version = await loadVersion();
        res.json({
            site: '/api/sales',
            version,
            node: process.version,
            uptime: dayjs.duration(process.uptime()).toISOString(),
        });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("aboutAPI()", err.message);
            return Promise.reject(err);
        }
        debug("aboutAPI()", err);
        return Promise.reject(new Error('Error in aboutAPI()'));
    }
};
