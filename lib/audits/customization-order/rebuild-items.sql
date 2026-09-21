-- check for inactive or discontinued items
SELECT cim.itemCode, JSON_ARRAYAGG(cim.customizationCode ORDER BY cim.customizationCode)
FROM c2.IM_CustomizationItemMatch cim
WHERE EXISTS (SELECT 1
              FROM CI_Item i
              WHERE i.ItemCode = cim.itemCode
                AND (i.ProductType = 'D' OR i.InactiveItem = 'Y'))
GROUP BY cim.itemCode;

-- delete inactive or discontinued items
DELETE cim.*
FROM c2.IM_CustomizationItemMatch cim
WHERE EXISTS (SELECT 1
              FROM CI_Item i
              WHERE i.ItemCode = cim.itemCode
                AND (i.ProductType = 'D' OR i.InactiveItem = 'Y'));

-- 12115 singles
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12115'
  AND customizationCode IN ('/IM1R', '/IM1L', '/IM2');
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT DISTINCT bd.ComponentItemCode
                     FROM c2.CI_Item i
                              INNER JOIN c2.BM_BillHeader bh ON bh.BillNo = i.ItemCode
                              INNER JOIN c2.BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                     WHERE i.ItemCode LIKE '12115%IMP'
                       AND i.ProductType = 'K'
                       AND i.InactiveItem <> 'Y'
                       AND bd.ComponentItemCode NOT LIKE '1TG%')
SELECT cc.customizationCode AS customizationCode,
       i.ItemCode           AS itemCode,
       '12115'              AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.InactiveItem = 'N'
  AND i.SalesUnitOfMeasure = 'EA'
  AND i.ItemCode LIKE '12115%IMP'

UNION

-- 12115 party stripes
SELECT cc.customizationCode,
       i.ItemCode,
       '12115'
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.ProductType <> 'D'
  AND i.InactiveItem = 'N'
  AND i.ItemCode REGEXP ('12115(64|239|24[012])$')

UNION

-- 12115 mix components
SELECT cc.customizationCode,
       c.ComponentItemCode,
       '12115' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components c
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2');

-- insert screen print, 12424%IMP, /IM1R, /IM1L, /IM2
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12424';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT bd.ComponentItemCode
                     FROM CI_Item i
                              INNER JOIN BM_BillHeader bh ON bh.BillNo = i.ItemCode
                              INNER JOIN BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                     WHERE i.ItemCode LIKE '12424%IMP'
                       AND i.ProductType = 'K'
                       AND bd.ComponentItemCode NOT LIKE '1TG%')
SELECT cc.customizationCode,
       i.ItemCode AS itemCode,
       '12424'    AS sku
FROM IM_CustomizationCode cc
         CROSS JOIN CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.InactiveItem = 'N'
  AND i.SalesUnitOfMeasure = 'EA'
  AND i.ItemCode LIKE '12424%IMP'

UNION

SELECT cc.customizationCode,
       c.ComponentItemCode,
       '12424'
FROM IM_CustomizationCode cc
         CROSS JOIN _Components c
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2');


-- insert screen print, 12119, /IM1R, /IM1L, /IM2
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12119'
  AND customizationCode IN ('/IM1R', '/IM1L', '/IM2');
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT i2.ItemCode
                     FROM CI_Item i
                              INNER JOIN BM_BillHeader bh ON bh.BillNo = i.ItemCode
                              INNER JOIN BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN CI_Item i2 ON bd.ComponentItemCode = i2.ItemCode
                     WHERE i.ItemCode LIKE '12119%IMP'
                       AND i.ProductType = 'K'
                       AND bd.ComponentItemCode NOT LIKE '1TG%'
                       AND bd.ComponentItemCode <> 'STICKER'
                       AND i2.ProductType = 'F'
                       AND i2.InactiveItem <> 'Y')
-- singles
SELECT cc.customizationCode, i.ItemCode, '12119' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '12119[0-9]+$'
  AND cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.SalesUnitOfMeasure = 'EA'

UNION

-- mix components
SELECT cc.customizationCode, i.ItemCode, '12119' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2');

-- insert screen print, 12116, /IM1R, /IM1L, /IM2
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12116'
  AND customizationCode IN ('/IM1R', '/IM1L', '/IM2');
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT i2.ItemCode
                     FROM CI_Item i
                              INNER JOIN BM_BillHeader bh ON bh.BillNo = i.ItemCode
                              INNER JOIN BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN CI_Item i2 ON bd.ComponentItemCode = i2.ItemCode
                     WHERE i.ItemCode LIKE '12116%IMP'
                       AND i.ProductType = 'K'
                       AND bd.ComponentItemCode NOT LIKE '1TG%'
                       AND bd.ComponentItemCode <> 'STICKER'
                       AND i2.ProductType = 'F'
                       AND i2.InactiveItem <> 'Y')
-- singles
SELECT cc.customizationCode, i.ItemCode, '12116' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '12116[0-9]+$'
  AND cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.SalesUnitOfMeasure = 'EA'

UNION

-- mix components
SELECT cc.customizationCode, i.ItemCode, '12116' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2');

-- screen print, retainers 12112 
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12112'
  AND customizationCode IN ('/IM1R', '/IM1L', '/IM2');
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, '12112'
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '12112[0-9]+$';

-- 12207 No-Tail Adjustable
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12207';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT i2.ItemCode
                     FROM CI_Item i
                              INNER JOIN BM_BillHeader bh ON bh.BillNo = i.ItemCode
                              INNER JOIN BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN CI_Item i2 ON bd.ComponentItemCode = i2.ItemCode
                     WHERE i.ItemCode LIKE '12207%IMP'
                       AND i.ProductType = 'K'
                       AND i2.ProductType = 'F'
                       AND i2.InactiveItem <> 'Y')
-- 12207 Singles
SELECT cc.customizationCode, i.ItemCode, '12207' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.SalesUnitOfMeasure = 'EA'
  AND i.ItemCode REGEXP '12207[0-9]+$'

UNION
-- 12207 IMP Mix Components
SELECT cc.customizationCode, i.ItemCode, '12207' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1R', '/IM1L', '/IM2')
;

-- 12128 Neoprene Standard End
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12128'
  AND customizationCode = '/IM1';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT DISTINCT ci.ItemCode
                     FROM c2.CI_Item i
                              INNER JOIN c2.BM_BillHeader bh ON i.ItemCode = bh.BillNo
                              INNER JOIN c2.BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN c2.CI_Item ci ON bd.ComponentItemCode = ci.ItemCode
                     WHERE i.ProductType <> 'D'
                       AND i.InactiveItem <> 'Y'
                       AND i.ItemCode LIKE '12128%IMP'
                       AND bh.Revision = bh.CurrentBillRevision
                       AND ci.ProductType = 'F')
SELECT cc.customizationCode, i.ItemCode, '12128' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1')
;

-- 12306 Neoprene Large End
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12306'
  AND customizationCode = '/IM1';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT DISTINCT ci.ItemCode
                     FROM c2.CI_Item i
                              INNER JOIN c2.BM_BillHeader bh ON i.ItemCode = bh.BillNo
                              INNER JOIN c2.BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN c2.CI_Item ci ON bd.ComponentItemCode = ci.ItemCode
                     WHERE i.ProductType <> 'D'
                       AND i.InactiveItem <> 'Y'
                       AND i.ItemCode LIKE '12306%IMP'
                       AND bh.Revision = bh.CurrentBillRevision
                       AND ci.ProductType = 'F')
SELECT cc.customizationCode, i.ItemCode, '12306' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1')
;

-- 12129 Neoprene LTD
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '12129'
  AND customizationCode = '/IM1';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT DISTINCT cc.customizationCode, i.ItemCode, '12129' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^12129[0-9]+$';

-- 54413 Floating Phone Protector, 54419 Floating Phone Protector LTD
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku IN ('54413', '54419')
  AND customizationCode = '/IMFPP';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4 AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IMFPP')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^5441[39][0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- 54417 Splash Bag SMALL
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '54417'
  AND customizationCode = '/IMSBSM';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4 AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IMSBSM')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^54417[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- 54418 Splash Bag LARGE
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE sku = '54418'
  AND customizationCode = '/IMSBLG';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4 AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IMSBLG')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^54418[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;


-- Dome retainers: /DOMECD items
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE customizationCode = '/DOMECD';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode = '/DOMECD'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^(12106|12103|12111|12121|12204|12320|12322)[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Dome retainers: /DOMEGF items
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE customizationCode = '/DOMEGF';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode = '/DOMEGF'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^(12131|12135)[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Dome Accessories: /DOMEHC
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE customizationCode = '/DOMEHC';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode = '/DOMEHC'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^11106[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Dome Accessories: /DOMEGH
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE customizationCode = '/DOMEGH';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode = '/DOMEGH'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^30054[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Dome Lanyards: 11115 /DOMECR, /IM1L, /IM1R, /IM2
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '11115'
  AND customizationCode IN ('/DOMECR', '/IM1L', '/IM1R', '/IM2');
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode IN ('/DOMECR')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^11115[0-9]+$'

UNION

SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'screen-print'
  AND cc.customizationCode IN ('/IM1L', '/IM1R', '/IM2')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^11115[0-9]+$'

ORDER BY customizationCode, ItemCode;


-- Dome Lanyards: 11097 /DOMECR, /DOMECD
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '11097'
  AND customizationCode IN ('/DOMECR', '/DOMECD');
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode IN ('/DOMECR', '/DOMECD')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^11097[0-9]+$';


-- Dome Large Retractor ID Holder
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '30023'
  AND customizationCode = '/DOMERL';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode = '/DOMERL'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode = '30023';

-- Dome Retractor+ ID Holder
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '33001'
  AND customizationCode = '/DOMERP';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'dome'
  AND cc.customizationCode = '/DOMERP'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode = '33001';

-- Stickers / Water Safety
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU REGEXP '^(82023|82038)$'
  AND customizationCode = '/STICKEROVAL';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'sticker'
  AND cc.customizationCode = '/STICKEROVAL'
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^(82023|82038)$';


-- Heat Transfer / Retainers /HTNEOSTD
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '12128'
  AND customizationCode = '/HTNEOSTD';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT DISTINCT ci.ItemCode
                     FROM c2.CI_Item i
                              INNER JOIN c2.BM_BillHeader bh ON i.ItemCode = bh.BillNo
                              INNER JOIN c2.BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN c2.CI_Item ci ON bd.ComponentItemCode = ci.ItemCode
                     WHERE i.ProductType <> 'D'
                       AND i.InactiveItem <> 'Y'
                       AND i.ItemCode LIKE '12128%IMP'
                       AND bh.Revision = bh.CurrentBillRevision
                       AND ci.ProductType = 'F')
SELECT cc.customizationCode, i.ItemCode, '12128' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTNEOSTD');

-- Heat Transfer / Retainers /HTNEOLRG
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '12306'
  AND customizationCode = '/HTNEOLRG';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
WITH _Components AS (SELECT DISTINCT ci.ItemCode
                     FROM c2.CI_Item i
                              INNER JOIN c2.BM_BillHeader bh ON i.ItemCode = bh.BillNo
                              INNER JOIN c2.BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
                              INNER JOIN c2.CI_Item ci ON bd.ComponentItemCode = ci.ItemCode
                     WHERE i.ProductType <> 'D'
                       AND i.InactiveItem <> 'Y'
                       AND i.ItemCode LIKE '12306%IMP'
                       AND bh.Revision = bh.CurrentBillRevision
                       AND ci.ProductType = 'F')
SELECT cc.customizationCode, i.ItemCode, '12306' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN _Components i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTNEOLRG');

-- Heat Transfer, Retainers /HTNEOLTD
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU = '12129'
  AND customizationCode = '/HTNEOLTD';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT DISTINCT cc.customizationCode, i.ItemCode, '12129' AS sku
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTNEOLTD')
  AND i.ProductType = 'F'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^12129[0-9]+$';
# INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
# WITH _Components AS (SELECT DISTINCT ci.ItemCode
#                      FROM c2.CI_Item i
#                               INNER JOIN c2.BM_BillHeader bh ON i.ItemCode = bh.BillNo
#                               INNER JOIN c2.BM_BillDetail bd ON bh.BillNo = bd.BillNo AND bh.Revision = bd.Revision
#                               INNER JOIN c2.CI_Item ci ON bd.ComponentItemCode = ci.ItemCode
#                      WHERE i.ProductType <> 'D'
#                        AND i.InactiveItem <> 'Y'
#                        AND i.ItemCode LIKE '12129%IMP'
#                        AND bh.Revision = bh.CurrentBillRevision
#                        AND ci.ProductType = 'F')
# SELECT cc.customizationCode, i.ItemCode, '12129' AS sku
# FROM c2.IM_CustomizationCode cc
#          CROSS JOIN _Components i
# WHERE cc.section = 'heat-transfer'
#   AND cc.customizationCode IN ('/HTNEOLTD');

-- Heat transfer, Accessories /HTNEOKEY
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('90024', '90028')
  AND customizationCode = '/HTNEOKEY';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTNEOKEY')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND (i.ItemCode REGEXP '^9002[48][0-9]+$' OR i.ItemCode REGEXP '^PL9002[48]$')
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Wallets /HTSURF
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('18401', '18403')
  AND customizationCode = '/HTSURF';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTSURF')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND i.ItemCode REGEXP '^1840[13][0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Wallets /HTBANDITZIP
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('18813')
  AND customizationCode = '/HTBANDITZIP';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTBANDITZIP')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND (i.ItemCode REGEXP '^18813[0-9]+$' OR i.ItemCode = 'PL18813')
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Wallets /HTMARS
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('90070', '90071')
  AND customizationCode = '/HTMARS';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTMARS')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND (i.ItemCode REGEXP '^9007[01][0-9]+$' OR i.ItemCode REGEXP '^PL9007[01]$')
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Eyewear Storage /HTSHADE
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('31090', '31104')
  AND customizationCode = '/HTSHADE';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTSHADE')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND (ItemCode REGEXP '^31104[0-9]+$' OR ItemCode = '31090100')
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Waist Packs /HTSWITCH
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('14104', '14105')
  AND customizationCode = '/HTSWITCH';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTSWITCH')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND ItemCode REGEXP '^1410[45][0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Waist Packs /HTTREKK
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('14037')
  AND customizationCode = '/HTTREKK';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTTREKK')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND ItemCode REGEXP '^14037[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Shoulder Bags /HTDAYTRIP
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('54431')
  AND customizationCode = '/HTDAYTRIP';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTDAYTRIP')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND ItemCode REGEXP '^54431[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;
INSERT IGNORE INTO c2.IM_CustomizationSKU (sku, section, category, options) values ('54431', 'heat-transfer', 'shoulder-bags', '{"moq": 12}');

-- Heat transfer, Shoulder Bags /HTINDIO
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('54268')
  AND customizationCode = '/HTINDIO';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTINDIO')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND ItemCode REGEXP '^54268[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Shoulder Bags /HTROVERPT
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('54269')
  AND customizationCode = '/HTROVERPT';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTROVERPT')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND ItemCode REGEXP '^54269[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

-- Heat transfer, Shoulder Bags /HTROVERCB
DELETE
FROM c2.IM_CustomizationItemMatch
WHERE SKU IN ('54266')
  AND customizationCode = '/HTROVERCB';
INSERT IGNORE INTO c2.IM_CustomizationItemMatch (customizationCode, itemCode, sku)
SELECT cc.customizationCode, i.ItemCode, i.Category4
FROM c2.IM_CustomizationCode cc
         CROSS JOIN c2.CI_Item i
WHERE cc.section = 'heat-transfer'
  AND cc.customizationCode IN ('/HTROVERCB')
  AND i.ProductType <> 'D'
  AND i.InactiveItem <> 'Y'
  AND ItemCode REGEXP '^54266[0-9]+$'
ORDER BY cc.customizationCode, i.ItemCode;

