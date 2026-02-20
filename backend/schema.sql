-- ================================
-- USERS
-- ================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN','STAFF')),
    pin TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- BUSINESS DAYS
-- ================================

CREATE TABLE IF NOT EXISTS business_days (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    opening_cash NUMERIC(10,2) DEFAULT 0,
    closing_cash NUMERIC(10,2),
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_business_days_date 
ON business_days(date);

-- ================================
-- DENOMINATIONS
-- ================================

CREATE TABLE IF NOT EXISTS denominations (
    id SERIAL PRIMARY KEY,
    business_day_id INTEGER REFERENCES business_days(id) ON DELETE CASCADE,
    note_value INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (business_day_id, note_value)
);

CREATE INDEX IF NOT EXISTS idx_denominations_day 
ON denominations(business_day_id);

-- ================================
-- MENU
-- ================================

CREATE TABLE IF NOT EXISTS menu (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- ORDERS
-- ================================

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    business_day_id INTEGER REFERENCES business_days(id),
    user_id INTEGER REFERENCES users(id),
    customer_name TEXT,
    customer_phone TEXT,
    payment_method TEXT,
    total NUMERIC(10,2) NOT NULL,
    is_paid BOOLEAN DEFAULT TRUE,
    amount_paid NUMERIC(10,2) DEFAULT 0,
    due_amount NUMERIC(10,2) DEFAULT 0,
    bill_number TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_business_day 
ON orders(business_day_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_at 
ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone 
ON orders(customer_phone);

CREATE INDEX IF NOT EXISTS idx_orders_bill_number 
ON orders(bill_number);

-- ================================
-- ORDER ITEMS
-- ================================

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu(id),
    item_name TEXT,
    quantity INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    price_snapshot NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON order_items(order_id);

-- ================================
-- CASH WITHDRAWALS
-- ================================

CREATE TABLE IF NOT EXISTS cash_withdrawals (
    id SERIAL PRIMARY KEY,
    business_day_id INTEGER NOT NULL 
        REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
