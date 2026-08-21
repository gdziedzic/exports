SELECT o.id, c.name AS customer_name, o.qty, o.unit_price, o.total, o.ordered_at
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.unit_price >= @MinPrice
