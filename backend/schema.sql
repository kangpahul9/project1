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
    -- reason TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE cash_withdrawals
ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE TYPE withdrawal_reason AS ENUM (
  'Owner Personal',
  'Supplier Payment',
  'Bank Deposit',
  'Petty Cash',
  'Staff Salary',
  'Utilities',
  'Emergency Expense',
  'Loan Repayment',
  'Investment Transfer',
  'Other'
);

ALTER TABLE cash_withdrawals
DROP COLUMN IF EXISTS reason;

ALTER TABLE cash_withdrawals
ADD COLUMN reason withdrawal_reason;

CREATE TABLE cash_deposits (
    id SERIAL PRIMARY KEY,
    business_day_id INTEGER REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    business_day_id INTEGER REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'online')) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE cash_deposits ADD COLUMN description TEXT;


CREATE TYPE ledger_type AS ENUM (
  'opening',
  'sale',
  'expense',
  'withdrawal',
  'closing_adjustment'
);

CREATE TABLE cash_ledger (
  id SERIAL PRIMARY KEY,
  business_day_id INTEGER NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
  type ledger_type NOT NULL,
  reference_id INTEGER,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_ledger_day ON cash_ledger(business_day_id);

ALTER TABLE business_days
ADD COLUMN closed_by INTEGER REFERENCES users(id),
ADD COLUMN closing_difference NUMERIC(10,2) DEFAULT 0,
ADD COLUMN closing_reason TEXT,
ADD COLUMN has_discrepancy BOOLEAN DEFAULT false;

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent duplicate vendor names
CREATE UNIQUE INDEX unique_vendor_name ON vendors (LOWER(name));

ALTER TABLE expenses
ADD COLUMN vendor_id INTEGER REFERENCES vendors(id) ON DELETE RESTRICT;

ALTER TABLE expenses
ALTER COLUMN vendor_id SET NOT NULL;

ALTER TABLE expenses
ADD CONSTRAINT positive_expense_amount CHECK (amount > 0);

INSERT INTO vendors (name)
VALUES ('Unknown Vendor')
RETURNING id;

ALTER TABLE expenses
ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE expenses
ALTER COLUMN payment_method DROP NOT NULL;

ALTER TABLE expenses
ADD COLUMN amount_paid NUMERIC(10,2) DEFAULT 0;

ALTER TABLE expenses
ADD COLUMN paid_at TIMESTAMP;

ALTER TABLE expenses
ADD COLUMN paid_by INTEGER REFERENCES users(id);

CREATE TABLE vendor_settlements (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  business_day_id INTEGER REFERENCES business_days(id),
  total_due NUMERIC(10,2) NOT NULL,
  total_paid NUMERIC(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('card','online','cash_withdrawal')) NOT NULL,
  withdrawal_id INTEGER REFERENCES cash_withdrawals(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE expenses
ADD COLUMN settlement_id INTEGER REFERENCES vendor_settlements(id);

ALTER TABLE expenses
ADD COLUMN deduct_from_galla BOOLEAN DEFAULT false;

ALTER TABLE vendors
ADD COLUMN description TEXT;

ALTER TABLE expenses
ADD COLUMN document_url TEXT;

ALTER TABLE vendor_settlements
DROP CONSTRAINT vendor_settlements_payment_method_check;

ALTER TABLE vendor_settlements
ADD CONSTRAINT vendor_settlements_payment_method_check
CHECK (payment_method IN ('cash','online','card'));

ALTER TABLE expenses
ALTER COLUMN vendor_id DROP NOT NULL;

CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  salary NUMERIC(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE staff_transactions (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES staff(id),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT CHECK (type IN ('advance','salary','deduction')),
  reason TEXT,
  business_day_id INTEGER REFERENCES business_days(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE staff_roster (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES staff(id),
  date DATE NOT NULL,
  shift_start TIME,
  shift_end TIME,
  created_by INTEGER REFERENCES users(id)
);

ALTER TABLE staff_transactions
DROP CONSTRAINT staff_transactions_type_check;

ALTER TABLE staff_transactions
ADD CONSTRAINT staff_transactions_type_check
CHECK (type IN ('payment','adjustment'));

ALTER TABLE staff_transactions
ADD COLUMN withdrawal_id INTEGER REFERENCES cash_withdrawals(id);

ALTER TABLE staff_transactions
ADD COLUMN payment_method TEXT,
ADD COLUMN deduct_from_galla BOOLEAN DEFAULT FALSE,
ADD COLUMN withdrawal_id INTEGER REFERENCES cash_withdrawals(id);