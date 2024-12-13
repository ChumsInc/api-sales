import { apiFetchJSON } from "chums-local-modules";
import Debug from "debug";
const debug = Debug('chums:lib:utils:images');
export async function loadImages(itemCodes) {
    try {
        if (itemCodes.length === 0 || !itemCodes) {
            return [];
        }
        const params = new URLSearchParams();
        params.append('item', itemCodes.join(','));
        const url = '/api/images/products/find/80/?' + params.toString();
        const json = await apiFetchJSON(url);
        return json?.imageList ?? [];
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadImages()", err.message);
            return Promise.reject(err);
        }
        debug("loadImages()", err);
        return Promise.reject(new Error('Error in loadImages()'));
    }
}
