import {ProductImage} from "chums-types";
import {apiFetchJSON} from "chums-local-modules";
import {ImageListResponse} from "../account/types.js";
import Debug from "debug";

const debug = Debug('chums:lib:utils:images');

export async function loadImages(itemCodes: string[]): Promise<ProductImage[]> {
    try {
        if (itemCodes.length === 0 || !itemCodes) {
            return [];
        }
        const params = new URLSearchParams();
        params.append('item', itemCodes.join(','));
        const url = '/api/images/products/find/80/?' + params.toString();
        const json = await apiFetchJSON<ImageListResponse>(url);
        return json?.imageList ?? [];
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("loadImages()", err.message);
            return Promise.reject(err);
        }
        debug("loadImages()", err);
        return Promise.reject(new Error('Error in loadImages()'));
    }
}
