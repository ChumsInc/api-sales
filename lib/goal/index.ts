import {mysql2Pool} from 'chums-local-modules';
import Debug from "debug";
import {RowDataPacket} from "mysql2";
import {Request, Response} from "express";
import dayjs from "dayjs";
const debug = Debug('chums:lib:goal');

export interface PeriodGoal {
    FiscalPeriod: string;
    goal: number;
}
interface PeriodGoalRow extends RowDataPacket, Omit<PeriodGoal, 'goal'>{
    goal: string;
}

export async function loadCompanyGoal(fiscalYear?:string|undefined):Promise<PeriodGoal[]> {
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
        const data = {fiscalYear};
        const [rows] = await mysql2Pool.query<PeriodGoalRow[]>(query, data);
        return rows.map(row => ({
            FiscalPeriod: row.FiscalPeriod,
            goal: +row.goal
        }));
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadCompanyGoal()", err.message);
            return Promise.reject(err);
        }
        debug("loadCompanyGoal()", err);
        return Promise.reject(new Error('Error in loadCompanyGoal()'));
    }
}

export async function getCompanyGoal(req:Request, res:Response):Promise<void> {
    try {
        const today = new Date();
        const params = {
            Company: req.params.Company || 'chums',
            FiscalYear: req.params.FiscalYear || today.getFullYear()
        };
        const goal = await loadCompanyGoal(req.params.fiscalYear as string);
        res.json({goal});
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getCompanyGoal()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getCompanyGoal'});
    }
}
