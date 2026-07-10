import type {SalesRep} from "./types.d.ts";
import {mysql2Pool, type ValidatedUser} from "chums-local-modules";
import type {RowDataPacket} from "mysql2";
import Debug from "debug";
import type {Request, Response} from "express";

const debug = Debug('chums:lib:rep:pace:rep-list');

const sql = `
    WITH RECURSIVE
        IsEmployee AS (SELECT 1 AS IsEmployee
                       FROM users.users
                       WHERE id = :userId
                         AND active = 1
                         AND accountType = 1),
        UserReps (SalesManagerDivisionNo, SalesManagerNo, SalespersonDivisionNo, SalespersonNo, SalespersonName, Level)
            AS (SELECT sp.SalesManagerDivisionNo,
                       sp.SalesManagerNo,
                       sp.SalespersonDivisionNo,
                       sp.SalespersonNo,
                       sp.SalespersonName,
                       0 AS Level
                FROM c2.ar_salesperson sp
                         INNER JOIN users.UserCustomerAccess uac
                                    ON sp.SalespersonDivisionNo LIKE uac.SalespersonDivisionNo AND
                                       sp.SalespersonNo LIKE uac.SalespersonNo
                WHERE uac.userId = :userId
                  AND IFNULL(sp.UDF_TERMINATED, 'N') <> 'Y'
                  AND IF((SELECT COUNT(*) > 0 FROM IsEmployee),
                         (
                             sp.SalesManagerDivisionNo IS NULL AND
                             sp.SalesManagerNo IS NULL
                             ),
                         1
                      )

                UNION ALL

                SELECT sp.SalesManagerDivisionNo,
                       sp.SalesManagerNo,
                       sp.SalespersonDivisionNo,
                       sp.SalespersonNo,
                       sp.SalespersonName,
                       Level + 1
                FROM c2.ar_salesperson sp
                         INNER JOIN UserReps r ON sp.SalesManagerDivisionNo = r.SalespersonDivisionNo AND
                                                  sp.SalesManagerNo = r.SalespersonNo
                WHERE IFNULL(sp.UDF_TERMINATED, 'N') <> 'Y'),
        DisinctUserReps AS (SELECT *
                            FROM UserReps r
                            WHERE r.Level = 0
                               OR (CONCAT_WS('-', r.SalespersonDivisionNo, r.SalespersonNo) NOT IN
                                   (SELECT DISTINCT CONCAT_WS('-', SalespersonDivisionNo, SalespersonNo)
                                    FROM UserReps
                                    WHERE Level < r.Level)))
    SELECT CONCAT_WS('-', r.SalespersonDivisionNo, r.SalespersonNo) AS Salesperson,
           CONCAT_WS('-', r.SalesManagerDivisionNo, r.SalesManagerNo) AS SalesManager,
           r.SalespersonName
    FROM DisinctUserReps r
    ORDER BY Salesperson
`

type SalesRepRow = SalesRep & RowDataPacket;
export async function loadRepList(userId: number|string): Promise<SalesRep[]> {
    try {
        const [rows] = await mysql2Pool.query<SalesRepRow[]>(sql, {userId});
        return rows;
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("loadRepList()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepList()", err);
        return Promise.reject(new Error('Error in loadRepList()'));
    }
}

export async function getRepListV3(req:Request, res:Response<unknown, ValidatedUser>):Promise<void> {
    try {
        const userId = res.locals.profile.user.id;
        const repList = await loadRepList(userId);
        res.set('Cache-Control', 'private, max-age=3600');
        res.json(repList);
    } catch(err:unknown) {
        if (err instanceof Error) {
            debug("getRepList()", err.message);
            res.status(500).json({error: err.message, name: err.name});
            return;
        }
        res.status(500).json({error: 'unknown error in getRepList'});
    }
}
