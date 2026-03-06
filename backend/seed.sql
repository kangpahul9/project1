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





