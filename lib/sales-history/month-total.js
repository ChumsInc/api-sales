/**
 * Created by steve on 4/8/2016.
 */
"use strict";

import Debug from "debug";

const debug = Debug('chums:lib:sales:salesorder');
import {mysql2Pool} from 'chums-local-modules';
import {loadCompanyGoal} from '../goal/index.js';


export const getMonthHistory = function (req, res, next) {
    const params = {
        company: req.params.Company,
        user_id: res.locals.user.id
    };
    loadMonthHistory(params)
        .then(result => {
            res.locals.history = result;
            next();
            return null;
        })
        .catch(err => {
            res.jsonp({error: err});
        });
};

export const getMonthOpen = function (req, res, next) {
    const params = {
        company: req.params.Company,
        user_id: res.locals.user.id
    };
    loadMonthOpen(params)
        .then(result => {
            res.locals.open = result;
            next();
            return null;
        })
        .catch(err => {
            res.jsonp({error: err});
        });
};

export async function getHistoryGraphData(req, res) {
    try {
        const params = {
            ...req.params,
            user_id: res.locals.profile.user.id,
        }
        const [goalBudget, history, openOrders] = await Promise.all([loadCompanyGoal(params), loadMonthHistory(params), loadMonthOpen(params)]);
        history.forEach(row => {
            const [open] = openOrders.filter(oo => oo.month === row.month).map(oo => oo.Open);
            row.open = open;
            const [goal] = goalBudget.filter(g => Number(g.FiscalPeriod) === row.month).map(g => g.goal);
            row.goal = goal;
        })
        res.json({goal: goalBudget, history, open: openOrders});
    } catch(err) {
        debug("loadHistoryGraphData()", err.message);
        res.json({error: err.message});
    }
}


/**
 *
 * @param {object} params
 * @param {string} params.company
 * @param {number} params.user_id
 */
export async function loadMonthHistory({Company, user_id}) {
    try {
        const today = new Date();
        const years = [0, 1, 2].map(y => new Date(today.getFullYear() - y, 0, 1));
        const query = `select month(h.InvoiceDate) as month, 
            sum(if (year(h.InvoiceDate) = year(:year0), h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt, null)) as Year0,
            sum(if (year(h.InvoiceDate) = year(:year1), h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt, 0)) as Year1,
            sum(if (year(h.InvoiceDate) = year(:year2), h.NonTaxableSalesAmt + h.TaxableSalesAmt - h.DiscountAmt, 0)) as Year2
            FROM c2.ar_division d
            INNER JOIN c2.ar_invoicehistoryheader h on h.Company = d.Company and h.ARDivisionNo = d.ardivisionno
            INNER JOIN users.accounts a
                ON h.company like a.Company
                AND (
                    (h.SalespersonDivisionNo like a.SalespersonDivisionNo and h.SalespersonNo like a.SalespersonNo)
                    OR (h.ARDivisionNo like a.ARDivisionNo and h.CustomerNo like a.CustomerNo)
                )
            WHERE a.userid = :userid and h.Company = :company
                AND year(h.InvoiceDate) between year(:year2) and year(:year0)
            GROUP BY month`;
        const data = {userid: user_id, company: Company, year0: years[0], year1: years[1], year2: years[2]};
        const [rows] = await mysql2Pool.query(query, data)
        rows.forEach(row => {
            row.Year0 = row.Year0 === null ? null : Number(row.Year0);
            row.Year1 = Number(row.Year1);
            row.Year2 = Number(row.Year2);
        });
        return rows;
    } catch(err) {
        debug("loadMonthHistory()", err.message);
        return Promise.reject(err);
    }
}

/**
 *
 * @param {object} params
 * @param {string} params.company
 * @param {number} params.user_id
 */
export async function loadMonthOpen({Company, user_id}) {
    try {
        const year = new Date().getFullYear();

        const query = `SELECT MONTH(IF(h.ShipExpireDate < NOW(), NOW(), h.ShipExpireDate)) AS month,
                              SUM(h.OrderTotal)                                            AS Open
                       FROM c2.SO_SalesOrderHeader h
                            INNER JOIN users.accounts a
                                       ON h.company LIKE a.Company
                                           AND (
                                                  (h.SalespersonDivisionNo LIKE a.SalespersonDivisionNo AND
                                                   h.SalespersonNo LIKE a.SalespersonNo)
                                                  OR
                                                  (h.ARDivisionNo LIKE a.ARDivisionNo AND h.CustomerNo LIKE a.CustomerNo)
                                              )
                       WHERE h.Company = :company
                         AND a.userid = :userid
                         AND YEAR(h.ShipExpireDate) = :year
                         AND OrderType IN ('S', 'B')
                       GROUP BY month`;
        const data = {userid: user_id, company: Company, year};
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.Open = Number(row.Open);
        });
        return [1,2,3,4,5,6,7,8,9,10,11,12]
            .map(val => {
                const [{Open = 0} = {}] = rows.filter(row => row.month === val);
                return {month: val, Open};
            });
    } catch (err) {
        debug("loadMonthOpen()", err.message);
        return Promise.reject(err);
    }
}
