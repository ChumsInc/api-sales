import Debug from "debug";
import {getDBCompany, mysql2Pool} from 'chums-local-modules';

const debug = Debug('chums:lib:sales:rep:validate-rep');

async function loadRepValidation({id, company, salespersonDivisionNo, salespersonNo}) {
    try {
        const query = `SELECT count(*) > 0 AS allow
                       FROM users.accounts
                       WHERE (userid = :id OR api_id = :apiId)
                         AND company = :company
                         AND :salespersonDivisionNo LIKE SalespersonDivisionNo
                         AND :salespersonNo LIKE SalespersonNo`;
        const data = {id, apiId: id * -1, company: getDBCompany(company), salespersonDivisionNo, salespersonNo};

        const [[{allow = 0}]] = await mysql2Pool.query(query, data);
        return allow === 1;
    } catch (err) {
        debug("validate()", err.message);
        return Promise.reject(err);
    }
}

export async function validateRep(req, res, next) {
    try {
        const allow = await loadRepValidation({...req.params, id: res.locals.profile.user.id});
        if (allow) {
            return next();
        }
        res.status(403).json({error: 'permission denied'});
    } catch (err) {
        debug("validate()", err.message);
        res.json({error: err.message});
    }
}

