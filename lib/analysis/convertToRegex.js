const RE_ESC_WILDCARDS = /(?<!\\)[%_]/g;
const RE_WILDCARDS = /[%_]/g;
/**
 *
 * @param {string} str
 * @param {boolean} strict
 * @returns {string}
 */
function convertString(str = '', strict = false) {
    if (!str) {
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
function convertObjectValues(obj, strict = false) {
    const result = {...obj};
    Object.keys.forEach(key => {
        if (typeof result[key] === "string") {
            result[key] = convertString(result[key], strict);
        }
    });
    return result;
}

exports.convertString = convertString;
exports.convertObjectValues = convertObjectValues;
