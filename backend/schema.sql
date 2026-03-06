BEGIN;

-- ================================
-- ENUMS
-- ================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'withdrawal_reason') THEN
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
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_type') THEN
        CREATE TYPE ledger_type AS ENUM (
            'opening',
            'sale',
            'expense',
            'withdrawal',
            'closing_adjustment'
        );
    END IF;
END
$$;

-- ================================
-- USERS
-- ================================
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF')),
    pin TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- BUSINESS DAYS
-- ================================
CREATE TABLE IF NOT EXISTS business_days (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_cash NUMERIC(10,2),
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    opened_by BIGINT REFERENCES users(id),
    closed_by BIGINT REFERENCES users(id),
    closing_difference NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_reason TEXT,
    has_discrepancy BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_days_date ON business_days(date);

-- ================================
-- MENU
-- ================================
CREATE TABLE IF NOT EXISTS menu (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- ORDERS
-- ================================
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_day_id BIGINT REFERENCES business_days(id),
    user_id BIGINT REFERENCES users(id),
    customer_name TEXT,
    customer_phone TEXT,
    payment_method TEXT,
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    due_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    bill_number TEXT UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_business_day ON orders(business_day_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_bill_number ON orders(bill_number);

-- ================================
-- ORDER ITEMS
-- ================================
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id BIGINT REFERENCES menu(id),
    item_name TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    price_snapshot NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ================================
-- DENOMINATIONS
-- ================================
CREATE TABLE IF NOT EXISTS denominations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_day_id BIGINT NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
    note_value INTEGER NOT NULL CHECK (note_value > 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (business_day_id, note_value)
);

CREATE INDEX IF NOT EXISTS idx_denominations_day ON denominations(business_day_id);

-- ================================
-- CASH WITHDRAWALS
-- ================================
CREATE TABLE IF NOT EXISTS cash_withdrawals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_day_id BIGINT NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    user_id BIGINT REFERENCES users(id),
    reason withdrawal_reason,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- CASH DEPOSITS
-- ================================
CREATE TABLE IF NOT EXISTS cash_deposits (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_day_id BIGINT REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    user_id BIGINT REFERENCES users(id),
    reason TEXT,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- VENDORS
-- ================================
CREATE TABLE IF NOT EXISTS vendors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    description TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_vendor_name ON vendors (LOWER(name));

-- ================================
-- VENDOR SETTLEMENTS
-- ================================
CREATE TABLE IF NOT EXISTS vendor_settlements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
    business_day_id BIGINT REFERENCES business_days(id),
    total_due NUMERIC(10,2) NOT NULL CHECK (total_due >= 0),
    total_paid NUMERIC(10,2) NOT NULL CHECK (total_paid >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'online', 'card')),
    withdrawal_id BIGINT REFERENCES cash_withdrawals(id),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- EXPENSES
-- ================================
CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_day_id BIGINT REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    description TEXT,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'online')),
    user_id BIGINT REFERENCES users(id),
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE RESTRICT,
    settlement_id BIGINT REFERENCES vendor_settlements(id),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_at TIMESTAMP,
    paid_by BIGINT REFERENCES users(id),
    deduct_from_galla BOOLEAN NOT NULL DEFAULT FALSE,
    document_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- CASH LEDGER
-- ================================
CREATE TABLE IF NOT EXISTS cash_ledger (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_day_id BIGINT NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
    type ledger_type NOT NULL,
    reference_id BIGINT,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_day ON cash_ledger(business_day_id);

-- ================================
-- STAFF
-- ================================
CREATE TABLE IF NOT EXISTS staff (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    salary NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id BIGINT REFERENCES staff(id),
    amount NUMERIC(10,2) NOT NULL,
    type TEXT CHECK (type IN ('payment', 'adjustment')),
    reason TEXT,
    business_day_id BIGINT REFERENCES business_days(id),
    withdrawal_id BIGINT REFERENCES cash_withdrawals(id),
    payment_method TEXT,
    deduct_from_galla BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_roster (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id BIGINT REFERENCES staff(id),
    date DATE NOT NULL,
    shift_start TIME,
    shift_end TIME,
    created_by BIGINT REFERENCES users(id)
);


COMMIT;


ALTER TABLE expenses
ADD COLUMN staff_id INTEGER;

ALTER TABLE expenses
ADD CONSTRAINT expenses_staff_id_fkey
FOREIGN KEY (staff_id)
REFERENCES staff(id)
ON DELETE SET NULL;

ALTER TABLE expenses
ADD COLUMN source TEXT DEFAULT 'manual';

ALTER TABLE staff_transactions
ADD COLUMN expense_id INTEGER REFERENCES expenses(id);

CREATE INDEX idx_staff_transactions_expense_id
ON staff_transactions(expense_id);

ALTER TABLE staff
ADD COLUMN joining_date DATE;

ALTER TABLE staff
ALTER COLUMN joining_date SET DEFAULT CURRENT_DATE;

ALTER TABLE staff
ADD COLUMN salary_cycle TEXT DEFAULT 'monthly';

---> new
ALTER TABLE staff_transactions
ADD COLUMN salary_month DATE;