import { mysql2Pool } from 'chums-local-modules';
import Debug from "debug";
import dayjs from "dayjs";
const debug = Debug('chums:lib:goal');
export async function loadCompanyGoal(fiscalYear) {
    try {
        if (!fiscalYear) {
            fiscalYear = dayjs().format('YYYY');
        }
        const query = `SELECT b.FiscalPeriod, SUM(b.CreditAmount) AS goal
                       FROM c2.ar_division d
                            LEFT JOIN c2.gl_account a
                                      ON a.Company = d.Company AND
                                         a.Account LIKE CONCAT('42__-02-', d.PostSalesToGLSubAcct)
                            LEFT JOIN c2.gl_periodbudgetdetail b
                                      ON b.Company = a.Company AND b.AccountKey = a.AccountKey
                       WHERE a.Company = 'chums'
                         AND b.FiscalYear = :fiscalYear
                         AND b.BudgetCode = 'REVISED'
                       GROUP BY FiscalPeriod`;
        const data = { fiscalYear };
        const [rows] = await mysql2Pool.query(query, data);
        return rows.map(row => ({
            FiscalPeriod: row.FiscalPeriod,
            goal: +row.goal
        }));
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCompanyGoal()", err.message);
            return Promise.reject(err);
        }
        debug("loadCompanyGoal()", err);
        return Promise.reject(new Error('Error in loadCompanyGoal()'));
    }
}
export async function getCompanyGoal(req, res) {
    try {
        const goal = await loadCompanyGoal(req.params.fiscalYear);
        res.json({ goal });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCompanyGoal()", err.message);
            res.status(500).json({ error: err.message, name: err.name });
            return;
        }
        res.status(500).json({ error: 'unknown error in getCompanyGoal' });
    }
}
