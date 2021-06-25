const {mysql2Pool} = require('chums-local-modules');
const debug = require('debug')('chums:lib:b2b:promo_code');

async function loadPromoCodes({id, promo_code, active, valid}) {
    try {
        const query = `SELECT id,
                              promo_code,
                              description,
                              active,
                              requirements,
                              actions,
                              valid_from,
                              valid_to,
                              require_code_entry
                       FROM b2b.promo_codes
                       WHERE (ifnull(:id, '') = '' OR id = :id)
                         AND (ifnull(:promo_code, '') = '' OR promo_code = :promo_code)
                         AND (ifnull(:active, '') = '' OR active = :active)
                         AND (ifnull(:valid, '') = '' OR active = 1)
                         AND (ifnull(:valid, '') = '' OR valid_from <= now())
                         AND (ifnull(:valid, '') = '' OR valid_to >= now())
                         AND (ifnull(:valid, '') = '' OR (promo_code = :promo_code OR require_code_entry = 0))
                       ORDER BY promo_code`;
        const data = {id, promo_code, active, valid};
        const [codes] = await mysql2Pool.query(query, data);
        codes.forEach(row => {
            row.requirements = JSON.parse(row.requirements);
            row.actions = JSON.parse(row.actions);
            row.active = !!row.active;
            row.require_code_entry = !!row.require_code_entry;
        });
        return codes;
    } catch (err) {
        debug("loadPromoCodes()", err.message);
        return err;
    }
}

async function getPromoCodes(req, res) {
    try {
        const promo_codes = await loadPromoCodes({...req.query, ...req.params});
        res.json({promo_codes});
    } catch (err) {
        debug("getCodes()", err.message);
        res.json({error: err.message});
    }
}

exports.getPromoCodes = getPromoCodes;
exports.loadPromoCodes = loadPromoCodes;
