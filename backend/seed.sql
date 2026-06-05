-- ================================
-- KangPOS Seed Data
-- Password for admin: admin123
-- Run: psql -U postgres -d kangpos_prod -f seed.sql
-- ================================

-- ================================
-- RESTAURANT
-- ================================
INSERT INTO restaurants (restaurant_uid, name, phone, email, address, currency, receipt_footer)
VALUES (
    'kangpos-001',
    'KangPOS Restaurant',
    '+61400000000',
    'admin@kangpos.com',
    'Adelaide, South Australia',
    '$',
    'Thank you 🙏 Visit Again'
) ON CONFLICT (restaurant_uid) DO NOTHING;

-- ================================
-- ADMIN USER
-- Password: admin123
-- ================================
INSERT INTO users (restaurant_id, name, role, email, password_hash)
SELECT
    r.id,
    'Admin',
    'ADMIN',
    'admin@kangpos.com',
    '$2b$10$An8rOueM8sYIfYK8cqZx5OaAcqfyoZexfh2xzHUaR.VVM4rP97kpO'
FROM restaurants r
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

-- ================================
-- RESTAURANT SETTINGS
-- ================================
INSERT INTO restaurant_settings (
    restaurant_id,
    use_business_day,
    enable_cash_recount,
    allow_staff_print,
    enable_vendor_ledger,
    enable_customer_ledger,
    enable_email,
    enable_partners,
    enable_manual_change,
    use_payroll,
    currency_code,
    currency_symbol,
    currency_locale
)
SELECT
    r.id,
    TRUE, TRUE, TRUE, TRUE, TRUE,
    FALSE, FALSE, FALSE, FALSE,
    'AUD', '$', 'en-AU'
FROM restaurants r
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT (restaurant_id) DO NOTHING;

-- ================================
-- COMMUNICATION SETTINGS
-- ================================
INSERT INTO communication_settings (restaurant_id, send_bill_email, notify_owner_email)
SELECT r.id, FALSE, FALSE
FROM restaurants r
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT (restaurant_id) DO NOTHING;

-- ================================
-- MENU CATEGORIES
-- ================================
INSERT INTO menu_categories (restaurant_id, name, color, sort_order)
SELECT r.id, 'Mains', '#6366F1', 1
FROM restaurants r WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu_categories (restaurant_id, name, color, sort_order)
SELECT r.id, 'Drinks', '#10B981', 2
FROM restaurants r WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu_categories (restaurant_id, name, color, sort_order)
SELECT r.id, 'Snacks', '#F59E0B', 3
FROM restaurants r WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu_categories (restaurant_id, name, color, sort_order)
SELECT r.id, 'Desserts', '#EC4899', 4
FROM restaurants r WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

-- ================================
-- MENU ITEMS
-- ================================

-- Mains
INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Butter Chicken', 18.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'mains'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Lamb Curry', 20.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'mains'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Dal Makhani', 15.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'mains'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Chicken Biryani', 22.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'mains'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Garlic Naan', 4.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'mains'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Steamed Rice', 3.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'mains'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

-- Drinks
INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Mango Lassi', 6.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'drinks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Masala Chai', 4.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'drinks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Soft Drink', 3.50, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'drinks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Water Bottle', 2.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'drinks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

-- Snacks
INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Samosa (2pc)', 5.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'snacks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Pakora', 7.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'snacks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Pappadum', 2.50, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'snacks'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

-- Desserts
INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Gulab Jamun', 6.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'desserts'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

INSERT INTO menu (restaurant_id, name, price, category_id)
SELECT r.id, 'Kheer', 5.00, mc.id
FROM restaurants r
JOIN menu_categories mc ON mc.restaurant_id = r.id AND LOWER(mc.name) = 'desserts'
WHERE r.restaurant_uid = 'kangpos-001'
ON CONFLICT DO NOTHING;

-- ================================
-- BANK ACCOUNT (optional default)
-- ================================
INSERT INTO bank_accounts (restaurant_id, name, account_holder, balance)
SELECT r.id, 'Main Account', 'KangPOS Restaurant', 0
FROM restaurants r
WHERE r.restaurant_uid = 'kangpos-001';