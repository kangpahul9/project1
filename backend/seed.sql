-- =========================================
-- USERS
-- =========================================

-- Admin (PIN: 1234)
INSERT INTO users (name, role, pin)
VALUES ('Admin', 'ADMIN', '0905')
ON CONFLICT DO NOTHING;

-- Staff (PIN: 1111)
INSERT INTO users (name, role, pin)
VALUES ('Staff', 'STAFF', '1111')
ON CONFLICT DO NOTHING;


-- =========================================
-- MENU ITEMS
-- =========================================

INSERT INTO menu (name, price) VALUES
('Veg Burger', 80.00),
('Cheese Burger', 100.00),
('Paneer Wrap', 120.00),
('French Fries', 60.00),
('Cold Coffee', 90.00),
('Masala Chai', 20.00),
('Mineral Water', 20.00),
('Veg Pizza', 250.00),
('Garlic Bread', 120.00),
('Chocolate Shake', 110.00)
ON CONFLICT (name) DO NOTHING;



