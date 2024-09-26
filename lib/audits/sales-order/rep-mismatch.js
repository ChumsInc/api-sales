import {mysql2Pool} from "chums-local-modules";
import Debug from 'debug';
import dayjs from "dayjs";

const debug = Debug('chums:lib:audits:sales-order:rep-mismatch');

const loadRepMismatch = async () => {
    const sql = `SELECT c.ARDivisionNo,
                        c.CustomerNo,
                        NULL                                                         AS ShipToCode,
                        c.CustomerName,
                        null as ShipToName,
                        CONCAT_WS('-', c.SalespersonDivisionNo, c.SalespersonNo)     AS CustomerRep,
                        rep.SalespersonName,
                        soh.SalesOrderNo,
                        soh.OrderType,
                        soh.OrderDate,
                        soh.ShipExpireDate,
                        CONCAT_WS('-', soh.SalespersonDivisionNo, soh.SalespersonNo) AS SalesOrderRep,
                        sorep.SalespersonName                                        AS SalesOrderRepName
                 FROM c2.SO_SalesOrderHeader soh
                          INNER JOIN c2.ar_customer c USING (Company, ARDivisionNo, CustomerNo)
                          LEFT JOIN c2.ar_salesperson rep ON rep.Company = c.Company AND
                                                             rep.SalespersonDivisionNo = c.SalespersonDivisionNo AND
                                                             rep.SalespersonNo = c.SalespersonNo
                          LEFT JOIN c2.ar_salesperson sorep ON sorep.Company = soh.Company AND
                                                               sorep.SalespersonDivisionNo =
                                                               soh.SalespersonDivisionNo AND
                                                               sorep.SalespersonNo = soh.SalespersonNo
                 WHERE soh.Company = 'chums'
                   AND soh.ShipToCode IS NULL
                   AND ((CONCAT_WS('-', soh.SalespersonDivisionNo, soh.SalespersonNo) <>
                         CONCAT_WS('-', c.SalespersonDivisionNo, c.SalespersonNo))
                     OR IFNULL(sorep.UDF_TERMINATED, 'N') = 'Y')
                   AND sorep.SalesManagerNo <> rep.SalespersonNo
                   AND c.SalespersonNo NOT IN ('H00E', 'H00W', 'TEST', '0000', 'H04', 'H01', 'H00')
                   AND soh.OrderType <> 'Q'

                 UNION

                 SELECT soh.ARDivisionNo,
                        soh.CustomerNo,
                        soh.ShipToCode,
                        soh.BillToName as CustomerName,
                        soh.ShipToName,
                        st.CustomerRep,
                        st.SalespersonName,
                        soh.SalesOrderNo,
                        soh.OrderType,
                        soh.OrderDate,
                        soh.ShipExpireDate,
                        soh.SalesOrderRep,
                        soh.SalespersonName AS SalesOrderRepName
                 FROM (SELECT h.*,
                              CONCAT_WS('-', sp.SalespersonDivisionNo, sp.SalespersonNo)   AS SalesOrderRep,
                              CONCAT_WS('-', sp.SalesManagerDivisionNo, sp.SalesManagerNo) AS SalesManager,
                              sp.SalespersonName,
                              sp.UDF_TERMINATED
                       FROM c2.SO_SalesOrderHeader h
                                LEFT JOIN c2.ar_salesperson sp ON sp.Company = h.Company AND
                                                                  sp.SalespersonDivisionNo = h.SalespersonDivisionNo AND
                                                                  sp.SalespersonNo = h.SalespersonNo) soh
                          INNER JOIN (SELECT st.*,
                                             CONCAT_WS('-', sp.SalespersonDivisionNo, sp.SalespersonNo)   AS CustomerRep,
                                             CONCAT_WS('-', sp.SalesManagerDivisionNo, sp.SalesManagerNo) AS SalesManager,
                                             sp.SalespersonName,
                                             sp.UDF_TERMINATED
                                      FROM c2.SO_ShipToAddress st
                                               LEFT JOIN c2.ar_salesperson sp ON sp.Company = st.Company AND
                                                                                 sp.SalespersonDivisionNo =
                                                                                 st.SalespersonDivisionNo AND
                                                                                 sp.SalespersonNo = st.SalespersonNo) st
                                     ON st.Company = soh.Company AND
                                        st.ARDivisionNo = soh.ARDivisionNo AND
                                        st.CustomerNo = soh.CustomerNo AND
                                        st.ShipToCode = IFNULL(soh.ShipToCode, '')
                 WHERE soh.Company = 'chums'
                   AND soh.OrderType <> 'Q'
                   AND st.SalespersonNo NOT IN ('H00E', 'H00W', 'TEST', '0000', 'H04', 'H01', 'H00')
                   AND (NOT (st.CustomerRep = soh.SalesOrderRep OR st.SalesManager = soh.SalesManager) OR
                        IFNULL(soh.UDF_TERMINATED, 'N') = 'Y')

                 ORDER BY ARDivisionNo, CustomerNo, SalesOrderNo
    `;
    try {
        const [rows] = await mysql2Pool.query(sql);
        return rows;
    } catch(err) {
        debug('loadRepMismatch()', err);
        if (err instanceof Error) {
            debug("loadRepMismatch()", err.message);
            return Promise.reject(err);
        }
        debug("loadRepMismatch()", err);
        return Promise.reject(new Error('Error in loadRepMismatch()'));
    }
}

export const getRepMismatch = async (req, res) => {
    try {
        const orders = await loadRepMismatch();
        res.json({orders})
    } catch(err) {
        if (err instanceof Error) {
            debug("getRepMismatch()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getRepMismatch'});
    }
}

export const renderRepMismatch = async (req, res) => {
    try {
        const list = await loadRepMismatch();
        if (!list.length) {
            res.status(204).send();
            return;
        }
        const orders = list.map(row => ({
            ...row,
            OrderDate: dayjs(row.OrderDate).format('MM-DD-YYYY'),
            ShipExpireDate: dayjs(row.ShipExpireDate).format('MM-DD-YYYY'),
        }))
        res.render('sales/mismatch-rep-orders.pug', {orders});
    } catch(err) {
        if (err instanceof Error) {
            debug("renderRepMismatch()", err.message);
            return Promise.reject(err);
        }
        debug("renderRepMismatch()", err);
        return Promise.reject(new Error('Error in renderRepMismatch()'));
    }
}
