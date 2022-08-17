const {mysql2Pool} = require("chums-local-modules");
const debug = require('debug')('chums:lib:sales:pricing');

/**
 *
 * @param {PriceCodeChange} priceCode
 * @return {boolean}
 */
const hasPriceChange = (priceCode) => {
    return (
        !!priceCode.timestamp && !!priceCode.DateUpdated
        && (new Date(priceCode.timestamp).valueOf() > new Date(priceCode.DateUpdated).valueOf())
        && ((priceCode.newDiscountMarkup1 ?? 0) !== priceCode.DiscountMarkup1)
    ) || (!priceCode.DateUpdated && (priceCode.newDiscountMarkup1 ?? 0) !== 0);
}


/**
 * @param {string} [priceLevel]
 * @return {Promise<PriceLevel[]>}
 */
const loadPriceLevels = async (priceLevel) => {
    try {
        const query = `
            SELECT pc.PriceLevel,
                   IFNULL(pl.PriceLevelDescription, '') AS PriceLevelDescription,
                   IFNULL(pl.SortOrder, 0)              AS SortOrder,
                   IFNULL(pl.active, 0)                 AS active,
                   IFNULL(c.customers, 0)               AS customers,
                   IFNULL(pcc.priceCodes, 0)            AS priceCodes
            FROM (
                     SELECT DISTINCT Company, CustomerPriceLevel AS PriceLevel
                     FROM c2.im_pricecode
                     WHERE CustomerPriceLevel <> ''
                     UNION
                     SELECT DISTINCT Company, PriceLevel
                     FROM c2.ar_customer
                     WHERE CustomerStatus = 'A'
                       AND PriceLevel IS NOT NULL
                     ) pc
                 LEFT JOIN c2.IM_PriceLevels pl
                           ON dbCompany(pl.Company) = pc.Company AND pl.PriceLevel = pc.PriceLevel
                 LEFT JOIN (
                SELECT Company, PriceLevel, COUNT(*) AS customers
                FROM c2.ar_customer
                WHERE CustomerStatus = 'A'
                GROUP BY Company, PriceLevel
                ) c
                           ON c.Company = pc.Company AND c.PriceLevel = pc.PriceLevel
                 LEFT JOIN (
                SELECT pc.Company, pc.CustomerPriceLevel, COUNT(DISTINCT pc.PriceCode) AS priceCodes
                FROM c2.im_pricecode pc
                     INNER JOIN c2.ci_item i
                                ON i.company = pc.Company AND i.PriceCode = pc.PriceCode
                WHERE i.ProductType <> 'D'
                  AND i.InactiveItem <> 'Y'
                  AND pc.PriceCodeRecord = 0
                GROUP BY Company, CustomerPriceLevel
                ) pcc
                           ON pcc.Company = pc.Company AND pcc.CustomerPriceLevel = pc.PriceLevel
            WHERE pc.Company = 'chums'
              AND (IFNULL(:priceLevel, '') = '' OR pc.PriceLevel = :priceLevel)

            UNION

            SELECT pl.PriceLevel, pl.PriceLevelDescription, pl.SortOrder, pl.active, c.customers, pcc.priceCodes
            FROM c2.IM_PriceLevels pl
                 LEFT JOIN (
                SELECT Company, PriceLevel, COUNT(*) AS customers
                FROM c2.ar_customer
                WHERE CustomerStatus = 'A'
                GROUP BY Company, PriceLevel
                ) c
                           ON c.Company = dbCompany(pl.Company) AND c.PriceLevel = pl.PriceLevel
                 LEFT JOIN (
                SELECT pc.Company, pc.CustomerPriceLevel, COUNT(DISTINCT pc.PriceCode) AS priceCodes
                FROM c2.im_pricecode pc
                     INNER JOIN c2.ci_item i
                                ON i.company = pc.Company AND i.PriceCode = pc.PriceCode
                WHERE i.ProductType <> 'D'
                  AND i.InactiveItem <> 'Y'
                  AND pc.PriceCodeRecord = 0
                GROUP BY Company, CustomerPriceLevel
                ) pcc
                           ON pcc.Company = dbCompany(pl.Company) AND pcc.CustomerPriceLevel = pl.PriceLevel
            WHERE pl.Company = 'CHI'
              AND (IFNULL(:priceLevel, '') = '' OR pl.PriceLevel = :priceLevel)
            ORDER BY SortOrder, PriceLevel;
        `;
        const [rows] = await mysql2Pool.query(query, {priceLevel});
        const maxSortOrder = rows.reduce((pv, cv) => pv > cv.SortOrder ? pv : cv.SortOrder, 0);
        rows.forEach((row, index) => {
            row.active = !!row.active;
            row.SortOrder = !!row.SortOrder ? row.SortOrder : maxSortOrder + 10 + index
        })
        return rows;
    } catch (err) {
        debug("loadPriceLevels", err.message);
        return Promise.reject(err);
    }
};

async function loadPriceLevelCustomers(priceLevel) {
    try {
        const sql = `SELECT c.ARDivisionNo,
                            c.CustomerNo,
                            c.CustomerName,
                            c.CustomerType,
                            c.DateLastActivity,
                            MAX(hh.OrderDate) AS LastOrderDate
                     FROM c2.ar_customer c
                          INNER JOIN c2.SO_SalesOrderHistoryHeader hh
                                     ON hh.Company = c.Company AND hh.ARDivisionNo = c.ARDivisionNo AND
                                        hh.CustomerNo = c.CustomerNo
                     WHERE c.Company = 'chums'
                       AND c.ARDivisionNo <> '00'
                       AND c.CustomerStatus = 'A'
                       AND c.PriceLevel = :priceLevel
                       AND hh.OrderStatus NOT IN ('X', 'Z')
                     GROUP BY c.Company, c.ARDivisionNo, c.CustomerNo`;
        const args = {priceLevel};
        const [rows] = await mysql2Pool.query(sql, args);
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadPriceLevelCustomers()", err.message);
            return Promise.reject(err);
        }
        debug("loadPriceLevelCustomers()", err);
        return Promise.reject(new Error('Error in loadPriceLevelCustomers()'));
    }
}

/**
 *
 * @param {PriceLevel} pl
 * @return {Promise<PriceLevel[]>}
 */
async function savePriceLevel(pl) {
    try {
        const {PriceLevel, PriceLevelDescription, SortOrder} = pl;
        const sql = `INSERT INTO c2.IM_PriceLevels (Company, PriceLevel, PriceLevelDescription, SortOrder)
                     VALUES ('CHI', :PriceLevel, :PriceLevelDescription, :SortOrder)
                     ON DUPLICATE KEY UPDATE PriceLevelDescription = :PriceLevelDescription,
                                             SortOrder             = :SortOrder`;
        const args = {PriceLevel, PriceLevelDescription, SortOrder};
        await mysql2Pool.query(sql, args);
        return await loadPriceLevels(pl.PriceLevel);
    } catch (err) {
        if (err instanceof Error) {
            debug("savePriceLevel()", err.message);
            return Promise.reject(err);
        }
        debug("savePriceLevel()", err);
        return Promise.reject(new Error('Error in savePriceLevel()'));
    }
}

/**
 *
 * @param {Partial<PriceLevel[]>} sort
 * @return {Promise<PriceLevel[]>}
 */
async function savePriceLevelSort(sort = []) {
    try {
        const sql = `INSERT INTO c2.IM_PriceLevels (Company, PriceLevel, SortOrder)
                     VALUES ('CHI', :PriceLevel, :SortOrder)
                     ON DUPLICATE KEY UPDATE SortOrder = :SortOrder`;
        for await (const s of sort) {
            await mysql2Pool.query(sql, {PriceLevel: s.PriceLevel, SortOrder: s.SortOrder});
        }
        return await loadPriceLevels(pl.PriceLevel);
    } catch (err) {
        if (err instanceof Error) {
            debug("savePriceLevelSort()", err.message);
            return Promise.reject(err);
        }
        debug("savePriceLevelSort()", err);
        return Promise.reject(new Error('Error in savePriceLevelSort()'));
    }
}

/**
 *
 * @param {DBCompany} Company
 * @return {Promise<BasePriceCodeInfo[]>}
 */
const loadPriceCodeList = async ({Company}) => {
    try {
        const sql = `SELECT DISTINCT p.Company,
                                     p.PriceCodeRecord,
                                     p.PriceCode,
                                     p.PriceCodeDesc,
                                     p.PricingMethod,
                                     p.BreakQuantity1,
                                     p.DiscountMarkup1,
                                     DATE_ADD(p.DateUpdated, INTERVAL ROUND(p.TimeUpdated * 3600) SECOND) AS DateUpdated,
                                     ip.ct                                                                AS ItemsCount
                     FROM c2.im_pricecode p
                          INNER JOIN (
                         SELECT Company, PriceCode, COUNT(*) AS ct
                         FROM c2.ci_item
                         WHERE ProductType <> 'D'
                           AND InactiveItem <> 'Y'
                         GROUP BY Company, PriceCode
                         ) ip
                                     USING (Company, PriceCode)
                     WHERE p.Company = :Company
                       AND p.PriceCodeRecord = '0'
                       AND CustomerPriceLevel = ''`;
        const [rows] = await mysql2Pool.query(sql, {Company});
        rows.forEach(row => {
            row.DiscountMarkup1 = Number(row.DiscountMarkup1);
        })
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadPriceCodes()", err.message);
            return Promise.reject(err);
        }
        debug("loadPriceCodes()", err);
        return Promise.reject(new Error('Error in loadPriceCodes()'));
    }
}

/**
 *
 * @param {DBCompany} Company
 * @param {string} [PriceCode]
 * @param {string} [CustomerPriceLevel]
 * @return {Promise<PriceCodeChange[]>}
 */
async function loadPriceCode({Company, PriceCode, CustomerPriceLevel}) {
    try {
        const sql = `SELECT DISTINCT p.Company,
                                     p.PriceCodeRecord,
                                     p.PriceCode,
                                     p.PriceCodeDesc,
                                     p.PricingMethod,
                                     p.CustomerPriceLevel,
                                     p.BreakQuantity1,
                                     p.DiscountMarkup1,
                                     w.DiscountMarkup1                                                    AS newDiscountMarkup1,
                                     w.UserName,
                                     w.timestamp,
                                     DATE_ADD(p.DateUpdated, INTERVAL ROUND(p.TimeUpdated * 3600) SECOND) AS DateUpdated
                     FROM c2.im_pricecode p
                          LEFT JOIN c2.IM_PriceCode_work w
                                    ON c2.dbCompany(w.company) = p.Company
                                        AND w.PriceCodeRecord = p.PriceCodeRecord
                                        AND w.PriceCode = p.PriceCode
                                        AND w.CustomerPriceLevel = p.CustomerPriceLevel
                          LEFT JOIN (
                         SELECT DISTINCT company, PriceCode
                         FROM c2.ci_item
                         WHERE InactiveItem <> 'Y'
                           AND ProductType <> 'D'
                         ) i
                                    ON i.company = p.Company AND i.PriceCode = p.PriceCode
                     WHERE p.Company = :Company
                       AND p.PriceCodeRecord = '0'
                       AND (IFNULL(:PriceCode, '') = '' OR p.PriceCode = :PriceCode)
                       AND (IFNULL(:CustomerPriceLevel, '-') = '-' OR p.CustomerPriceLevel = :CustomerPriceLevel)
                       AND i.PriceCode IS NOT NULL

                     UNION

                     SELECT DISTINCT w.Company,
                                     w.PriceCodeRecord,
                                     w.PriceCode,
                                     w.PriceCodeDesc,
                                     w.PricingMethod,
                                     w.CustomerPriceLevel,
                                     w.BreakQuantity1,
                                     IFNULL(p.DiscountMarkup1, 0)                                         AS DiscountMarkup1,
                                     w.DiscountMarkup1                                                    AS newDiscountMarkup1,
                                     w.UserName,
                                     w.timestamp,
                                     DATE_ADD(p.DateUpdated, INTERVAL ROUND(p.TimeUpdated * 3600) SECOND) AS DateUpdated
                     FROM c2.IM_PriceCode_work w
                          LEFT JOIN c2.im_pricecode p
                                    ON c2.dbCompany(w.company) = p.Company
                                        AND w.PriceCodeRecord = p.PriceCodeRecord
                                        AND w.PriceCode = p.PriceCode
                                        AND w.CustomerPriceLevel = p.CustomerPriceLevel
                          LEFT JOIN (
                         SELECT DISTINCT company, PriceCode
                         FROM c2.ci_item
                         WHERE InactiveItem <> 'Y'
                           AND ProductType <> 'D'
                         ) i
                                    ON c2.sageCompany(i.company) = w.Company AND i.PriceCode = w.PriceCode
                     WHERE w.Company = c2.sageCompany(:Company)
                       AND w.PriceCodeRecord = '0'
                       AND (IFNULL(:PriceCode, '') = '' OR w.PriceCode = :PriceCode)
                       AND (IFNULL(:CustomerPriceLevel, '-') = '-' OR w.CustomerPriceLevel = :CustomerPriceLevel)
                       AND p.PriceCode IS NULL
                       AND i.PriceCode IS NOT NULL
/*
                     UNION

                     SELECT DISTINCT p.Company,
                                     p.PriceCodeRecord,
                                     p.PriceCode,
                                     p.PriceCodeDesc,
                                     p.PricingMethod,
                                     IFNULL(:CustomerPriceLevel, '')                                      AS CustomerPriceLevel,
                                     p.BreakQuantity1,
                                     p.DiscountMarkup1,
                                     NULL                                                                 AS newDiscountMarkup1,
                                     NULL                                                                 AS UserName,
                                     NULL                                                                 AS timestamp,
                                     DATE_ADD(p.DateUpdated, INTERVAL ROUND(p.TimeUpdated * 3600) SECOND) AS DateUpdated
                     FROM c2.im_pricecode p
                          LEFT JOIN c2.im_pricecode p2
                                    ON p2.Company = p.Company
                                        AND p2.PriceCodeRecord = p.PriceCodeRecord
                                        AND p2.PriceCode = p.PriceCode
                                        AND p2.CustomerPriceLevel = :CustomerPriceLevel
                          INNER JOIN (
                         SELECT DISTINCT company, PriceCode
                         FROM c2.ci_item
                         WHERE InactiveItem <> 'Y'
                           AND ProductType <> 'D'
                         ) i
                                     ON i.Company = p.Company AND i.PriceCode = p.PriceCode
                     WHERE p.Company = :Company
                       AND p.PriceCodeRecord = '0'
                       AND (IFNULL(:PriceCode, '') = '' OR p.PriceCode = :PriceCode)
                       AND p.CustomerPriceLevel = ''
                       AND p2.PriceCode IS NULL
*/
                     ORDER BY PriceCode, CustomerPriceLevel`;
        const args = {Company, PriceCode, CustomerPriceLevel};
        debug('loadPriceCode()', args);
        const [rows] = await mysql2Pool.query(sql, args);
        rows.forEach(row => {
            row.DiscountMarkup1 = row.DiscountMarkup1 === null ? null : Number(row.DiscountMarkup1);
            row.newDiscountMarkup1 = row.newDiscountMarkup1 === null ? null : Number(row.newDiscountMarkup1);
            row.hasChange = hasPriceChange(row);
        })
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadPriceCode()", err.message);
            return Promise.reject(err);
        }
        debug("loadPriceCode()", err);
        return Promise.reject(new Error('Error in loadPriceCode()'));
    }
}

/**
 *
 * @param {DBCompany} Company
 * @param {string} [PriceCode]
 * @return {Promise<PriceCodeItem[]>}
 */
async function loadPriceCodeItems({Company, PriceCode}) {
    try {
        if (!PriceCode) {
            return [];
        }
        const sql = `SELECT ItemCode,
                            ItemCodeDesc,
                            ProductType,
                            StandardUnitOfMeasure,
                            AverageUnitCost,
                            StandardUnitPrice,
                            SuggestedRetailPrice
                     FROM c2.ci_item
                     WHERE company = :Company
                       AND PriceCode = :PriceCode
                       AND PriceCode IS NOT NULL
                       AND ProductType <> 'D'
                       AND InactiveItem <> 'Y'`;
        const [rows] = await mysql2Pool.query(sql, {Company, PriceCode});
        return rows;
    } catch (err) {
        if (err instanceof Error) {
            debug("loadPriceCodeItems()", err.message);
            return Promise.reject(err);
        }
        debug("loadPriceCodeItems()", err);
        return Promise.reject(new Error('Error in loadPriceCodeItems()'));
    }
}

/**
 *
 * @param {PriceCodeChange} params
 * @returns {Promise<PriceCodeChange[]>}
 */
const saveNewPricing = async (params) => {
    try {
        const {
            Company, PriceCode, CustomerPriceLevel, PriceCodeDesc, PricingMethod, BreakQuantity1,
            newDiscountMarkup1, UserName
        } = params;
        if (newDiscountMarkup1 === undefined) {
            return deleteNewPricingRecord(params);
        }
        const query = `INSERT INTO c2.IM_PriceCode_work
                       (Company, PriceCodeRecord, PriceCode, PriceCodeDesc, CustomerPriceLevel, PricingMethod,
                        BreakQuantity1, DiscountMarkup1, UserName)
                       VALUES (c2.sageCompany(:Company), :PriceCodeRecord, :PriceCode, :PriceCodeDesc,
                               :CustomerPriceLevel,
                               :PricingMethod,
                               :BreakQuantity1, :DiscountMarkup1, :UserName)
                       ON DUPLICATE KEY UPDATE DiscountMarkup1 = :DiscountMarkup1,
                                               UserName        = :UserName
        `;
        const data = {
            Company,
            PriceCodeRecord: '0',
            PriceCode,
            PriceCodeDesc,
            CustomerPriceLevel,
            PricingMethod,
            BreakQuantity1,
            DiscountMarkup1: newDiscountMarkup1,
            UserName,
        };
        debug('saveNewPricing()', data);
        await mysql2Pool.query(query, data);
        return await loadPriceCode({Company, CustomerPriceLevel, PriceCode});
    } catch (err) {
        debug("saveNewPricing", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {Object} params
 * @param {DBCompany} params.Company
 * @param {string} params.PriceCode
 * @param {string} params.CustomerPriceLevel
 * @returns {Promise<PriceCodeChange[]>}
 */
const deleteNewPricingRecord = async (params) => {
    try {
        const {Company, PriceCode, CustomerPriceLevel} = params;
        const query = `DELETE
                       FROM c2.IM_PriceCode_work
                       WHERE Company = c2.sageCompany(:Company)
                         AND PriceCodeRecord = :PriceCodeRecord
                         AND PriceCode = :PriceCode
                         AND CustomerPriceLevel = :CustomerPriceLevel`;
        const data = {Company, PriceCodeRecord: '0', PriceCode, CustomerPriceLevel};
        await mysql2Pool.query(query, data);
        return await loadPriceCode({Company, CustomerPriceLevel, PriceCode});
    } catch (err) {
        debug("deletePricing", err.message);
        return Promise.reject(err);
    }
};

/**
 *
 * @param {DBCompany} Company
 * @return {Promise<PriceCodeUser[]>}
 */
const loadPriceChangeUsers = async ({Company}) => {
    try {
        const query = `SELECT u.id,
                              u.name AS UserName,
                              u.email,
                              SUM(
                                      IF(
                                                      IFNULL(pc.DiscountMarkup1, 0) <> w.DiscountMarkup1
                                                  AND
                                                      w.timestamp > IFNULL(
                                                              DATE_ADD(pc.DateUpdated, INTERVAL pc.TimeUpdated * 3600 SECOND),
                                                              0),
                                                      1, 0)
                                  )  AS Changes
                       FROM c2.IM_PriceCode_work w
                            INNER JOIN users.users u
                                       ON u.email = w.UserName
                            LEFT JOIN c2.im_pricecode pc
                                      ON pc.Company = c2.dbCompany(w.company)
                                          AND pc.PriceCodeRecord = w.PriceCodeRecord
                                          AND pc.PriceCode = w.PriceCode
                                          AND pc.CustomerPriceLevel = w.CustomerPriceLevel
                       WHERE w.Company = c2.sageCompany(:Company)
                       GROUP BY u.name
                       ORDER BY u.name`;
        const data = {Company};
        const [rows] = await mysql2Pool.query(query, data);
        return rows;
    } catch (err) {
        debug('loadUsers()', err.message);
        return Promise.reject(err);
    }
};
/**
 *
 * @param {DBCompany} Company
 * @param {string} UserName
 * @param {string} ignoreUpdates
 * @return {Promise<PriceCodeChange[]>}
 */
const loadUserPriceChanges = async ({Company, UserName, ignoreUpdates}) => {
    try {
        const query = `
            SELECT c2.dbCompany(w.company)                                       AS Company,
                   w.PriceCodeRecord,
                   w.PriceCode,
                   IFNULL(p.PriceCodeDesc, '')                                   AS PriceCodeDesc,
                   w.PricingMethod,
                   w.CustomerPriceLevel,
                   p.BreakQuantity1,
                   IFNULL(p.DiscountMarkup1, 0)                                  AS DiscountMarkup1,
                   w.DiscountMarkup1                                             AS newDiscountMarkup1,
                   w.UserName,
                   w.timestamp,
                   DATE_ADD(p.DateUpdated, INTERVAL p.TimeUpdated * 3600 SECOND) AS DateUpdated
            FROM c2.IM_PriceCode_work w
                 LEFT JOIN c2.im_pricecode p
                           ON c2.dbCompany(w.company) = p.Company
                               AND w.PriceCodeRecord = p.PriceCodeRecord
                               AND w.PriceCode = p.PriceCode
                               AND w.CustomerPriceLevel = p.CustomerPriceLevel
            WHERE w.Company = c2.sageCompany(:Company)
              AND w.UserName = :UserName
              AND ((IFNULL(p.DiscountMarkup1, 0) <> w.DiscountMarkup1
                AND w.timestamp > IFNULL(DATE_ADD(p.DateUpdated, INTERVAL p.TimeUpdated * 3600 SECOND), 0))
                OR :ignoreUpdates = 'ignore'
                )
            ORDER BY PriceCode, CustomerPriceLevel, timestamp`;
        const data = {Company, UserName, ignoreUpdates};
        debug('loadUserPriceChanges()', data);
        const [rows] = await mysql2Pool.query(query, data);
        rows.forEach(row => {
            row.DiscountMarkup1 = row.DiscountMarkup1 === null ? null : Number(row.DiscountMarkup1);
            row.newDiscountMarkup1 = row.newDiscountMarkup1 === null ? null : Number(row.newDiscountMarkup1);
            row.hasChange = hasPriceChange(row);
        })
        return rows;
    } catch (err) {
        debug("loadUserVIFile()", err.message);
        return Promise.reject(err);
    }
};

const getPriceChangeUsers = async (req, res) => {
    try {
        const result = await loadPriceChangeUsers(req.params);
        res.json(result);
    } catch (err) {
        if (err instanceof Error) {
            debug("getUsers()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getUsers'});
    }
};

const getUserPriceChanges = async (req, res) => {
    try {
        const result = await loadUserPriceChanges({...req.query, ...req.params});
        res.json(result);
    } catch (err) {
        if (err instanceof Error) {
            debug("getUserPriceChanges()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getUserPriceChanges'});
    }
};

const getUserChangesImport = async (req, res) => {
    try {
        const result = await loadUserPriceChanges(req.params);
        const changes = result
            .map(row => {
                const {
                    PriceCodeRecord,
                    PriceCode,
                    CustomerPriceLevel,
                    PricingMethod,
                    BreakQuantity1,
                    newDiscountMarkup1
                } = row;
                return [
                    PriceCodeRecord,
                    PriceCode,
                    CustomerPriceLevel,
                    PricingMethod,
                    BreakQuantity1,
                    newDiscountMarkup1
                ].join('\t');
            })
            .join('\n');
        const [date] = new Date().toISOString().split('T');
        const filename = `IM_PRICECODE-:Company-:User-:Date.txt`
            .replace(':Company', req.params.Company)
            .replace(':User', req.params.UserName.replace(/@\S+$/, ''))
            .replace(':Date', date);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.send(changes);
    } catch (err) {
        if (err instanceof Error) {
            debug("getUserChangesImport()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getUserChangesImport'});
    }
};


const getPriceCode = async (req, res) => {
    try {
        const pricing = await loadPriceCode(req.params);
        const items = await loadPriceCodeItems(req.params);
        res.json({pricing, items});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPricing()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPricing'});
    }
};

const postNewPricing = async (req, res) => {
    try {
        const params = {...req.body, Company: req.params.Company, UserName: res.locals.profile.user.email};
        const pricing = await saveNewPricing(params)
        res.json({pricing});
    } catch (err) {
        if (err instanceof Error) {
            debug("postNewPricing()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postNewPricing'});
    }
};

const delNewPricingEntry = async (req, res) => {
    try {
        const pricing = await deleteNewPricingRecord(req.params);
        res.json({pricing});
    } catch (err) {
        if (err instanceof Error) {
            debug("delNewPricingEntry()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in delNewPricingEntry'});
    }
};

const getPriceLevels = async (req, res) => {
    try {
        const priceLevels = await loadPriceLevels();
        res.json({priceLevels});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPriceLevels()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPriceLevels'});
    }
};

const getPriceLevel = async (req, res) => {
    try {
        const [priceLevel] = await loadPriceLevels(req.params.CustomerPriceLevel);
        let customers = [];
        let pricing = [];
        if (priceLevel) {
            customers = await loadPriceLevelCustomers(req.params.CustomerPriceLevel);
            pricing = await loadPriceCode({Company: 'chums', CustomerPriceLevel: req.params.CustomerPriceLevel})
        }
        res.json({priceLevel, customers, pricing});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPriceLevel()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPriceLevel'});
    }

}

const postPriceLevel = async (req, res) => {
    try {
        const [priceLevel] = await savePriceLevel(req.body);
        let customers = [];
        let pricing = [];
        if (priceLevel) {
            customers = await loadPriceLevelCustomers(req.params.CustomerPriceLevel);
            pricing = await loadPriceCode({Company: 'chums', CustomerPriceLevel: req.params.CustomerPriceLevel})
        }
        res.json({priceLevel, customers, pricing});
    } catch (err) {
        if (err instanceof Error) {
            debug("postPriceLevel()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postPriceLevel'});
    }
}

const postPriceLevelSort = async (req, res) => {
    try {
        const body = req.body;
        const priceLevels = await savePriceLevelSort(body);
        res.json({priceLevels});
    } catch (err) {
        if (err instanceof Error) {
            debug("postPriceLevelSort()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in postPriceLevelSort'});
    }
}

const getAllPricing = async (req, res) => {
    try {
        const [priceLevels, priceCodes, users] = await Promise.all([
            loadPriceLevels(),
            loadPriceCodeList(req.params),
            loadPriceChangeUsers(req.params)
        ]);
        res.json({priceLevels, priceCodes, users});
    } catch (err) {
        if (err instanceof Error) {
            debug("getAllPricing()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getAllPricing'});
    }
}

const getPriceCodes = async (req, res) => {
    try {
        const priceCodes = await loadPriceCode({Company: req.params.Company, CustomerPriceLevel: ''});
        res.json({priceCodes});
    } catch (err) {
        if (err instanceof Error) {
            debug("getPriceCodes()", err.message);
            return res.json({error: err.message, name: err.name});
        }
        res.json({error: 'unknown error in getPriceCodes'});
    }
}

exports.getAllPricing = getAllPricing;
exports.getPriceCodes = getPriceCodes;
exports.getPriceLevel = getPriceLevel;
exports.postPriceLevel = postPriceLevel;
exports.postPriceLevelSort = postPriceLevelSort;
exports.getPriceLevels = getPriceLevels;
exports.getPriceCode = getPriceCode;
exports.getPriceChangeUsers = getPriceChangeUsers;
exports.getUserPriceChanges = getUserPriceChanges;
exports.getUserChangesImport = getUserChangesImport;
exports.postNewPricing = postNewPricing;
exports.delNewPricingEntry = delNewPricingEntry;

