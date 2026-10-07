WITH UserOrder AS (SELECT hh.SalesOrderNo, GROUP_CONCAT(hd.CommentText) AS UserComment
                   FROM c2.SO_SalesOrderHistoryHeader hh
                            INNER JOIN c2.SO_SalesOrderHistoryDetail hd ON hh.SalesOrderNo = hd.SalesOrderNo
                   WHERE hh.OrderDate BETWEEN '2026-07-01' AND '2026-09-30'
                     AND hh.UserCreatedKey = '0000000172'
                     AND hh.OrderType IN ('C', 'S')
                     AND EXISTS (SELECT 1
                                 FROM SO_SalesOrderHistoryDetail d
                                 WHERE d.SalesOrderNo = hh.SalesOrderNo
                                   AND d.ItemType = '4'
                                   AND d.ItemCode = '/C'
                                   AND (
                                     d.CommentText LIKE '%daisy%'
                                         OR d.CommentText LIKE '%michael%'
                                         OR d.CommentText LIKE '%nancy%'
                                         OR d.CommentText LIKE '%joce%'
                                         OR d.CommentText LIKE '%tesa%'
                                         OR d.CommentText LIKE '%sam%'
                                         OR d.CommentText LIKE '%jen%'
                                         OR d.CommentText LIKE '%colton%'
                                     ))
                     AND hd.ItemType = '4'
                     AND hd.ItemCode = '/C'
                   GROUP BY hh.SalesOrderNo)
SELECT h.SalesOrderNo,
       CONCAT_WS('-', h.ARDivisionNo, h.CustomerNo)                    AS CustomerNo,
       h.OrderDate,
       h.OrderType,
       h.OrderStatus,
       h.TaxableAmt + h.NonTaxableAmt - h.DiscountAmt                  AS OrderTotal,
       u.UserCode,
       IFNULL(uo.UserComment, CONCAT_WS(' ', u.FirstName, u.LastName)) AS UserName
FROM c2.SO_SalesOrderHistoryHeader h
         INNER JOIN c2.SY_User u ON h.UserCreatedKey = u.UserKey
         LEFT JOIN UserOrder uo ON h.SalesOrderNo = uo.SalesOrderNo
WHERE h.OrderDate >= '2026-07-01'
  AND h.OrderDate <= '2026-09-30'
  AND h.OrderStatus NOT IN ('X')
  AND h.OrderType NOT IN ('Q')
ORDER BY OrderDate, UserName;
