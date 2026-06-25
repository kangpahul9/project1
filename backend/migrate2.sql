-- KangPOS Migration 2 — Missing tables & columns
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Run: psql -h <host> -U postgres -d kangpos_prod -f migrate2.sql

BEGIN;

-- ================================================================
-- MENU — add multi-tenant + feature columns
-- ================================================================
ALTER TABLE menu ADD COLUMN IF NOT EXISTS restaurant_id BIGINT REFERENCES restaurants(id);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS category_id   INT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS usage_count   NUMERIC(10,3) DEFAULT 0;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS is_weight_based BOOLEAN DEFAULT FALSE;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS image_url     TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS barcode       TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Backfill restaurant_id for existing menu items (set to restaurant 1)
UPDATE menu SET restaurant_id = 1 WHERE restaurant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_category   ON menu(category_id);

-- ================================================================
-- MENU CATEGORIES
-- ================================================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id            SERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name          TEXT NOT NULL,
    color         TEXT DEFAULT '#6366F1',
    sort_order    INT DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    idempotency_key TEXT,
    UNIQUE (restaurant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_category_per_restaurant ON menu_categories (restaurant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON menu_categories (restaurant_id, sort_order);

-- ================================================================
-- ORDERS — restaurant_id
-- ================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id BIGINT REFERENCES restaurants(id);
UPDATE orders SET restaurant_id = 1 WHERE restaurant_id IS NULL;

-- ================================================================
-- ORDER_ITEMS — ensure table exists
-- ================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    order_id      BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id  BIGINT REFERENCES menu(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    price         NUMERIC(10,2) NOT NULL,
    quantity      INT NOT NULL DEFAULT 1,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);

-- ================================================================
-- DENOMINATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS denominations (
    id            SERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    value         NUMERIC(10,2) NOT NULL,
    label         TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    sort_order    INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_denominations_restaurant ON denominations(restaurant_id);

-- ================================================================
-- ORDER DENOMINATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS order_denominations (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    order_id      BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    denomination  NUMERIC(10,2) NOT NULL,
    quantity      INT NOT NULL DEFAULT 1,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- CASH DEPOSITS
-- ================================================================
CREATE TABLE IF NOT EXISTS cash_deposits (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT REFERENCES business_days(id),
    amount          NUMERIC(10,2) NOT NULL,
    source          TEXT,
    note            TEXT,
    created_by      BIGINT REFERENCES users(id),
    idempotency_key TEXT UNIQUE,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_deposits_restaurant ON cash_deposits(restaurant_id);

-- ================================================================
-- BANK ACCOUNTS
-- ================================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INT NOT NULL,
    name            TEXT NOT NULL,
    account_number  TEXT,
    account_holder  TEXT,
    bsb             TEXT,
    balance         NUMERIC DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_restaurant ON bank_accounts(restaurant_id);

-- Seed a default bank account for each restaurant (needed for bank route)
INSERT INTO bank_accounts (restaurant_id, name)
SELECT id, 'Main Account' FROM restaurants
WHERE id NOT IN (SELECT DISTINCT restaurant_id FROM bank_accounts)
ON CONFLICT DO NOTHING;

-- ================================================================
-- BANK TRANSACTIONS — add missing columns
-- ================================================================
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS bank_account_id INT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS source          TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS partner_id      BIGINT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS created_by      BIGINT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS is_reversal     BOOLEAN DEFAULT FALSE;

-- Backfill bank_account_id for existing rows
UPDATE bank_transactions bt
SET bank_account_id = ba.id
FROM bank_accounts ba
WHERE ba.restaurant_id = bt.restaurant_id
  AND bt.bank_account_id IS NULL;

-- ================================================================
-- ACTIVITY LOGS
-- ================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id            SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id       INT,
    action        TEXT,
    message       TEXT,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_restaurant ON activity_logs(restaurant_id);

-- ================================================================
-- STAFF ROSTER
-- ================================================================
CREATE TABLE IF NOT EXISTS staff_roster (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    staff_id      BIGINT REFERENCES staff(id),
    date          DATE NOT NULL,
    shift_start   TIME,
    shift_end     TIME,
    created_by    BIGINT REFERENCES users(id)
);

-- ================================================================
-- PARTNER LEDGER
-- ================================================================
CREATE TABLE IF NOT EXISTS partner_ledger (
    id            SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    partner_id    INT REFERENCES partners(id) ON DELETE CASCADE,
    type          TEXT,
    reference_id  INT,
    amount        NUMERIC,
    note          TEXT,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_restaurant ON partner_ledger(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner    ON partner_ledger(partner_id);

-- ================================================================
-- CASH RECOUNTS
-- ================================================================
CREATE TABLE IF NOT EXISTS cash_recounts (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INT NOT NULL,
    business_day_id INT REFERENCES business_days(id),
    user_id         INT REFERENCES users(id),
    total           NUMERIC NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- BILL SEQUENCES
-- ================================================================
CREATE TABLE IF NOT EXISTS bill_sequences (
    restaurant_id   INT NOT NULL,
    business_day_id INT NOT NULL,
    last_seq        INT NOT NULL DEFAULT 0,
    PRIMARY KEY (restaurant_id, business_day_id)
);

-- ================================================================
-- REFUNDS
-- ================================================================
CREATE TABLE IF NOT EXISTS refunds (
    id            BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    order_id      BIGINT NOT NULL,
    amount        NUMERIC(10,2) NOT NULL,
    idempotency_key TEXT,
    created_by    BIGINT,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refund_items (
    id           SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL,
    order_id      INT NOT NULL,
    menu_item_id  INT NOT NULL,
    quantity      INT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- LEDGER EVENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS ledger_events (
    id              BIGSERIAL PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL,
    business_day_id BIGINT,
    entity_type     TEXT,
    entity_id       BIGINT,
    event_type      TEXT,
    amount          NUMERIC,
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    created_by      BIGINT
);
CREATE INDEX IF NOT EXISTS idx_ledger_restaurant_day ON ledger_events (restaurant_id, business_day_id);
CREATE INDEX IF NOT EXISTS idx_ledger_event_type     ON ledger_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entity         ON ledger_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at     ON ledger_events (created_at);

-- ================================================================
-- COMBOS
-- ================================================================
CREATE TABLE IF NOT EXISTS combos (
    id            SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    menu_item_id  INT REFERENCES menu(id) ON DELETE CASCADE,
    combo_type    TEXT NOT NULL DEFAULT 'volume',
    bundle_price  NUMERIC(10,2),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_tiers (
    id         SERIAL PRIMARY KEY,
    combo_id   INT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    quantity   INT NOT NULL,
    price      NUMERIC(10,2) NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS combo_items (
    id           SERIAL PRIMARY KEY,
    combo_id     INT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    menu_item_id INT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
    quantity     INT NOT NULL DEFAULT 1
);

-- ================================================================
-- SHIFTS & ASSIGNMENTS (for payroll)
-- ================================================================
CREATE TABLE IF NOT EXISTS shifts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
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
CREATE INDEX IF NOT EXISTS idx_shifts_restaurant_date ON shifts (restaurant_id, date);

CREATE TABLE IF NOT EXISTS shift_assignments (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    shift_id      BIGINT REFERENCES shifts(id) ON DELETE CASCADE,
    staff_id      BIGINT REFERENCES staff(id) ON DELETE CASCADE,
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE (shift_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_staff ON shift_assignments(staff_id);

-- ================================================================
-- SHIFT LOGS — add missing columns to the table we created earlier
-- ================================================================
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS shift_id          BIGINT REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS scheduled_start   TIME;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS scheduled_end     TIME;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS actual_hours      NUMERIC(6,2);
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS pay_rate          NUMERIC(10,2);
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS overtime_rate     NUMERIC(10,2);
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS total_earnings    NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS paid_amount       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS remaining_amount  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS latitude          NUMERIC;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS longitude         NUMERIC;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS clock_in_location_text  TEXT;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS clock_out_location_text TEXT;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS is_auto_closed    BOOLEAN DEFAULT FALSE;
ALTER TABLE shift_logs ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'active';

-- ================================================================
-- PAYROLL TABLES (not in schema2, needed by payroll.js)
-- ================================================================
CREATE TABLE IF NOT EXISTS staff_advances (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    staff_id        BIGINT NOT NULL REFERENCES staff(id),
    amount          NUMERIC(10,2) NOT NULL,
    notes           TEXT,
    payroll_batch_id BIGINT,
    status          TEXT DEFAULT 'pending',
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_advances_restaurant ON staff_advances(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_staff      ON staff_advances(staff_id);

CREATE TABLE IF NOT EXISTS payroll_batches (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    status          TEXT DEFAULT 'draft',
    payment_method  TEXT,
    notes           TEXT,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_batches_restaurant ON payroll_batches(restaurant_id);

CREATE TABLE IF NOT EXISTS payroll_entries (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id),
    batch_id        BIGINT REFERENCES payroll_batches(id) ON DELETE CASCADE,
    staff_id        BIGINT REFERENCES staff(id),
    shift_id        BIGINT REFERENCES shifts(id),
    amount          NUMERIC(10,2) NOT NULL,
    hours           NUMERIC(6,2),
    status          TEXT DEFAULT 'paid',
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_batch     ON payroll_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_staff     ON payroll_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_restaurant ON payroll_entries(restaurant_id);

-- Foreign key for staff_advances → payroll_batches (deferred add)
ALTER TABLE staff_advances ADD COLUMN IF NOT EXISTS payroll_batch_id_fk BIGINT REFERENCES payroll_batches(id);

-- ================================================================
-- PAY TYPES — add missing columns
-- ================================================================
ALTER TABLE pay_types ADD COLUMN IF NOT EXISTS weekday_rate NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pay_types ADD COLUMN IF NOT EXISTS weekend_rate NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pay_types ADD COLUMN IF NOT EXISTS holiday_rate NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pay_types ADD COLUMN IF NOT EXISTS base_rate    NUMERIC(10,2) DEFAULT 0;

-- ================================================================
-- PARTNERS — add missing columns from new schema
-- ================================================================
ALTER TABLE partners ADD COLUMN IF NOT EXISTS share_percent NUMERIC;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS email TEXT;

-- ================================================================
-- SECURITY — token revocation + account lockout
-- ================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

COMMIT;
