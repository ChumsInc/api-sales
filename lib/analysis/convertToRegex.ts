const RE_ESC_WILDCARDS = /(?<!\\)[%_]/g;
const RE_WILDCARDS = /[%_]/g;
const isRegex = /[\^\[\]\)\(\$]/g;

/**
 *
 * @param {string} str
 * @param {boolean} strict
 * @returns {string}
 */
export function convertString(str:string|null|undefined = '', strict:boolean = false):string {
    if (!str) return '';
    if (strict && isRegex.test(str)) {
        return str;
    }
    strict = strict || (RE_WILDCARDS.test(str) && !RE_ESC_WILDCARDS.test(str));
    const res = str.replace(/(?<!\\)%/, '[.]*')
        .replace(/(?<!\\)_/, '.')
        .replace(/\\%/, '%')
        .replace(/\\_/, '_');
    if (!strict) {
        return res;
    }
    return `^${res}$`.replace('^^', '^').replace('$$', '$');
}

/**
 * Converts any string object values
 * @param {Object} obj
 * @param {boolean} strict
 * @returns {*}
 */
export function convertObjectValues(obj:Record<string, number|string>, strict = false) {
    const result:Record<string, number|string> = {...obj};
    Object.keys(obj).forEach(key => {
        if (typeof result[key] === "string") {
            result[key] = convertString(result[key], strict);
        }
    });
    return result;
}
