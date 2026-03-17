-- =========================================
-- USERS
-- =========================================

-- Admin (PIN: 0905)
INSERT INTO users (name, role, pin)
VALUES ('Admin', 'ADMIN', '0905')
ON CONFLICT DO NOTHING;

-- Seed a default vendor row if missing.
INSERT INTO vendors (name)
SELECT 'Unknown Vendor'
WHERE NOT EXISTS (
    SELECT 1 FROM vendors WHERE LOWER(name) = LOWER('Unknown Vendor')
);

-- Staff (PIN: 1111)
INSERT INTO users (name, role, pin)
VALUES ('Staff', 'STAFF', '1111')
ON CONFLICT DO NOTHING;



-->
UPDATE users
SET restaurant_id = 1
WHERE restaurant_id IS NULL;


UPDATE users
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE menu
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE orders
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE vendors
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE expenses
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE staff
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE business_days
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE cash_withdrawals
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE cash_deposits
SET restaurant_id = 1
WHERE restaurant_id IS NULL;
UPDATE order_items   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE denominations   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE vendor_settlements   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE cash_ledger   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE staff_transactions   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE staff_roster   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE menu_categories   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

UPDATE order_payments   
SET restaurant_id = 1
WHERE restaurant_id IS NULL;