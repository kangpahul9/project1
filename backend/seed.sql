-- KangPOS seed — run once on a fresh schema
-- psql ... -f seed.sql

BEGIN;

-- Need pgcrypto for bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================================================
-- RESTAURANT
-- uid is the code users type on the login screen
-- ================================================================
INSERT INTO restaurants (restaurant_uid, name, currency, receipt_footer)
VALUES ('kangpos', 'My Restaurant', '$', 'Thank you for dining with us!')
ON CONFLICT DO NOTHING;

-- ================================================================
-- USERS
-- Admin login: uid=kangpos  email=admin@kangpos.com  password=Admin@123
-- Staff login: uid=kangpos  email=staff@kangpos.com  password=Staff@123
-- Change these passwords immediately after first login.
-- ================================================================
INSERT INTO users (restaurant_id, name, role, email, password_hash)
VALUES (
  1,
  'Admin',
  'ADMIN',
  'admin@kangpos.com',
  crypt('Admin@123', gen_salt('bf', 10))
)
ON CONFLICT DO NOTHING;

INSERT INTO users (restaurant_id, name, role, email, password_hash)
VALUES (
  1,
  'Staff',
  'STAFF',
  'staff@kangpos.com',
  crypt('Staff@123', gen_salt('bf', 10))
)
ON CONFLICT DO NOTHING;

-- ================================================================
-- DEFAULT VENDOR
-- ================================================================
INSERT INTO vendors (name, restaurant_id)
SELECT 'Unknown Vendor', 1
WHERE NOT EXISTS (
    SELECT 1 FROM vendors WHERE LOWER(name) = 'unknown vendor'
);

-- ================================================================
-- DEFAULT SETTINGS ROW
-- ================================================================
INSERT INTO restaurant_settings (restaurant_id)
VALUES (1)
ON CONFLICT DO NOTHING;

-- ================================================================
-- PAY TYPES (payroll / roster feature)
-- ================================================================
INSERT INTO pay_types (restaurant_id, name, multiplier)
VALUES
  (1, 'Weekday',        1.0),
  (1, 'Saturday',       1.25),
  (1, 'Sunday',         1.5),
  (1, 'Public Holiday', 2.0)
ON CONFLICT DO NOTHING;

COMMIT;
