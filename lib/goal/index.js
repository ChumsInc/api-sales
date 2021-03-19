const {mysql2Pool} = require('chums-local-modules');
const debug = require('debug')('chums:lib:goal');

/**
 *
 * @param {Object} params
 * @param {string} params.Company
 * @param {string} params.FiscalYear
 */
async function loadCompanyGoal({Company, FiscalYear}) {
    try {
        if (!FiscalYear) {
            FiscalYear = String(new Date().getFullYear());
        }
        const query = `SELECT b.FiscalPeriod, SUM(b.CreditAmount) AS goal
                       FROM c2.ar_division d
                            LEFT JOIN c2.gl_account a
                                      ON a.Company = d.Company AND
                                         a.Account LIKE CONCAT('42__-02-', d.PostSalesToGLSubAcct)
                            LEFT JOIN c2.gl_periodbudgetdetail b
                                      ON b.Company = a.Company AND b.AccountKey = a.AccountKey
                       WHERE a.Company = :Company
                         AND b.FiscalYear = :FiscalYear
                         AND b.BudgetCode = 'REVISED'
                       GROUP BY FiscalPeriod`;
        const data = {Company, FiscalYear};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.goal = Number(row.goal);
        })
        return rows;
    } catch (err) {
        debug("loadCompanyGoal()", err.message);
        return Promise.reject(err);
    }
}

async function getCompanyGoal(req, res, next) {
    try {
        const today = new Date();
        const params = {
            Company: req.params.Company || 'chums',
            FiscalYear: req.params.FiscalYear || today.getFullYear()
        };
        const goal = await loadCompanyGoal(params);
        res.json({goal});
    } catch (err) {
        debug("getCompanyGoal()", err.message);
        res.json({error: err.message});
    }
}

exports.getCompanyGoal = getCompanyGoal;
exports.loadCompanyGoal = loadCompanyGoal;
