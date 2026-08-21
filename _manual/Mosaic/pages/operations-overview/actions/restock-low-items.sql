UPDATE stock_levels
SET quantity = quantity + @RestockAmount, updated_at = CURRENT_TIMESTAMP
WHERE quantity < @Threshold
