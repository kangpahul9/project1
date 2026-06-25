-- KangPOS Production Migration
-- Safe to run multiple times — all IF NOT EXISTS guards.
-- Run: psql -U kangpos -d kangpos_prod -f migrate.sql

BEGIN;

-- ================================================================
-- ORDERS — new columns
-- ================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_amount       NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_number      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_seq         INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount         NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted       BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_refunded      BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_qty     INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_amount  NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key  TEXT;

-- ================================================================
-- EXPENSES — new columns
-- ================================================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS settlement_id    BIGINT REFERENCES vendor_settlements(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS staff_id         INTEGER REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS partner_id       INT REFERENCES partners(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_at          TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by          BIGINT REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deduct_from_galla BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS document_url     TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source           TEXT DEFAULT 'manual';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date     DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS idempotency_key  TEXT UNIQUE;

-- ================================================================
-- ORDER_PAYMENTS — new table for split payments
-- ================================================================
CREATE TABLE IF NOT EXISTS order_payments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    order_id        BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'online')),
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    idempotency_key TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_payments_restaurant_match
        FOREIGN KEY (restaurant_id, order_id)
        REFERENCES orders (restaurant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_order_payments_order      ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_restaurant ON order_payments(restaurant_id);

-- ================================================================
-- PARTNERS — new table
-- ================================================================
CREATE TABLE IF NOT EXISTS partners (
    id            SERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name          TEXT NOT NULL,
    phone         TEXT,
    email         TEXT,
    notes         TEXT,
    balance       NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partners_restaurant ON partners(restaurant_id);

-- ================================================================
-- PARTNER_TRANSACTIONS — new table
-- ================================================================
CREATE TABLE IF NOT EXISTS partner_transactions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    partner_id    INT NOT NULL REFERENCES partners(id),
    amount        NUMERIC(10,2) NOT NULL,
    type          TEXT NOT NULL,
    note          TEXT,
    reference_id  BIGINT,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_txn_partner ON partner_transactions(partner_id);

-- ================================================================
-- RESTAURANT_SETTINGS — new columns
-- ================================================================
CREATE TABLE IF NOT EXISTS restaurant_settings (
    restaurant_id   INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
    use_business_day     BOOLEAN DEFAULT TRUE,
    enable_cash_recount  BOOLEAN DEFAULT TRUE,
    allow_staff_print    BOOLEAN DEFAULT TRUE,
    enable_vendor_ledger BOOLEAN DEFAULT TRUE,
    enable_customer_ledger BOOLEAN DEFAULT TRUE,
    enable_email         BOOLEAN DEFAULT FALSE,
    enable_partners      BOOLEAN DEFAULT FALSE,
    enable_manual_change BOOLEAN DEFAULT FALSE,
    use_payroll          BOOLEAN DEFAULT FALSE,
    payroll_provider     TEXT NULL,
    currency_code        VARCHAR(3) DEFAULT 'AUD',
    currency_symbol      VARCHAR(5) DEFAULT '$',
    currency_locale      VARCHAR(10) DEFAULT 'en-AU',
    payid                TEXT,
    payid_name           TEXT,
    eftpos_provider      TEXT DEFAULT NULL,
    eftpos_api_key       TEXT DEFAULT NULL,
    eftpos_merchant_id   TEXT DEFAULT NULL,
    eftpos_terminal_id   TEXT DEFAULT NULL,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS enable_manual_change BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS use_payroll          BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payroll_provider     TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_code        VARCHAR(3) DEFAULT 'AUD';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_symbol      VARCHAR(5) DEFAULT '$';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_locale      VARCHAR(10) DEFAULT 'en-AU';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payid                TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payid_name           TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_provider      TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_api_key       TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_merchant_id   TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_terminal_id   TEXT;

-- ================================================================
-- PAY TYPES + ROSTER (payroll feature)
-- ================================================================
CREATE TABLE IF NOT EXISTS pay_types (
    id            SERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name          TEXT NOT NULL,
    multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roster_shifts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    staff_id        INT NOT NULL REFERENCES staff(id),
    date            DATE NOT NULL,
    shift_start     TIME NOT NULL,
    shift_end       TIME NOT NULL,
    pay_type_id     INT REFERENCES pay_types(id),
    base_rate       NUMERIC(10,2),
    overtime_rate   NUMERIC(10,2),
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT check_base_rate CHECK (base_rate >= 0)
);
CREATE INDEX IF NOT EXISTS idx_roster_restaurant ON roster_shifts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_roster_staff      ON roster_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_date       ON roster_shifts(date);

-- ================================================================
-- COMMUNICATION SETTINGS — table + missing columns
-- ================================================================
CREATE TABLE IF NOT EXISTS communication_settings (
    restaurant_id       INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
    send_bill_email     BOOLEAN DEFAULT FALSE,
    notify_owner_email  BOOLEAN DEFAULT FALSE,
    owner_email         TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- VENDOR SETTLEMENTS — new table
-- ================================================================
CREATE TABLE IF NOT EXISTS vendor_settlements (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    vendor_id       BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
    business_day_id BIGINT REFERENCES business_days(id),
    total_due       NUMERIC(10,2) NOT NULL CHECK (total_due >= 0),
    total_paid      NUMERIC(10,2) NOT NULL CHECK (total_paid >= 0),
    payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'online', 'card')),
    withdrawal_id   BIGINT REFERENCES cash_withdrawals(id),
    partner_id      INT REFERENCES partners(id),
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_restaurant ON vendor_settlements(restaurant_id);

-- ================================================================
-- STAFF — new columns
-- ================================================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS joining_date   DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary         NUMERIC(10,2);

-- ================================================================
-- STAFF TRANSACTIONS — salary_month column
-- ================================================================
ALTER TABLE staff_transactions ADD COLUMN IF NOT EXISTS salary_month TIMESTAMP;

-- ================================================================
-- BANK LEDGER — new columns
-- ================================================================
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS event_type   TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS entity_type  TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS entity_id    BIGINT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS metadata     JSONB;

COMMIT;
