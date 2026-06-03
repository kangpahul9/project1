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
-- RESTAURANTS
-- ================================
CREATE TABLE IF NOT EXISTS restaurants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_uid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    logo_url TEXT,
    currency TEXT DEFAULT '$',
    receipt_footer TEXT DEFAULT 'Thank you 🙏 Visit Again',
    place_id TEXT,
    location_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_uid ON restaurants(restaurant_uid);

-- ================================
-- USERS
-- ================================
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF')),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_email_per_restaurant ON users (restaurant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_login ON users (restaurant_id, email);

-- ================================
-- BUSINESS DAYS
-- ================================
CREATE TABLE IF NOT EXISTS business_days (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    date DATE NOT NULL,
    opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_cash NUMERIC(10,2),
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    opened_by BIGINT REFERENCES users(id),
    closed_by BIGINT REFERENCES users(id),
    closing_difference NUMERIC(10,2) NOT NULL DEFAULT 0,
    closing_reason TEXT,
    has_discrepancy BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (restaurant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_business_days_date ON business_days(date);
CREATE INDEX IF NOT EXISTS idx_business_days_restaurant ON business_days(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_business_day_per_restaurant ON business_days (restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_business_day_restaurant_date ON business_days (restaurant_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS unique_business_day_per_date ON business_days (restaurant_id, date);

-- ================================
-- MENU CATEGORIES
-- ================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id SERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366F1',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    idempotency_key TEXT,
    UNIQUE (restaurant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_category_per_restaurant ON menu_categories (restaurant_id, LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_idempotency ON menu_categories (restaurant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON menu_categories (restaurant_id, sort_order);

-- ================================
-- MENU
-- ================================
CREATE TABLE IF NOT EXISTS menu (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    category_id INT,
    usage_count NUMERIC(10,3) DEFAULT 0,
    is_weight_based BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menu_category_restaurant
        FOREIGN KEY (restaurant_id, category_id)
        REFERENCES menu_categories (restaurant_id, id)
        ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_menu_name_per_restaurant ON menu (restaurant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_menu_category ON menu(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_idempotency ON menu (restaurant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ================================
-- ORDERS
-- ================================
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT REFERENCES business_days(id),
    user_id BIGINT REFERENCES users(id),
    customer_name TEXT,
    customer_phone TEXT,
    payment_method TEXT,
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    due_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    bill_number TEXT,
    bill_seq INTEGER,
    discount NUMERIC(10,2) DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_refunded BOOLEAN DEFAULT FALSE,
    refunded_qty INT DEFAULT 0,
    refunded_amount NUMERIC DEFAULT 0,
    idempotency_key TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT orders_payment_method_check CHECK (
        payment_method IN ('cash', 'online', 'card', 'unpaid', 'mixed-card', 'mixed-online')
    ),
    CONSTRAINT unique_order_per_restaurant UNIQUE (restaurant_id, id),
    CONSTRAINT orders_day_match FOREIGN KEY (restaurant_id, business_day_id)
        REFERENCES business_days (restaurant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_orders_business_day ON orders(business_day_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_day_restaurant ON orders (restaurant_id, business_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_bill_per_restaurant ON orders (restaurant_id, bill_number) WHERE bill_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_bill_number ON orders (restaurant_id, bill_number);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_idempotency'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT unique_idempotency UNIQUE (idempotency_key);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (restaurant_id, created_at);

-- ================================
-- ORDER ITEMS
-- ================================
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id BIGINT REFERENCES menu(id),
    item_name TEXT,
    quantity NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    price_snapshot NUMERIC(10,2),
    refunded_qty INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items (restaurant_id, item_name);

-- ================================
-- ORDER PAYMENTS
-- ================================
CREATE TABLE IF NOT EXISTS order_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'online')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    idempotency_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_payments_restaurant_match
        FOREIGN KEY (restaurant_id, order_id)
        REFERENCES orders (restaurant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_restaurant ON order_payments(restaurant_id);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_payment_idem'
    ) THEN
        ALTER TABLE order_payments ADD CONSTRAINT unique_payment_idem UNIQUE (order_id, idempotency_key);
    END IF;
END $$;

-- ================================
-- ORDER DENOMINATIONS
-- ================================
CREATE TABLE IF NOT EXISTS order_denominations (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    business_day_id BIGINT NOT NULL,
    note_value NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    type TEXT CHECK (type IN ('received', 'change', 'refund_given')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- DENOMINATIONS
-- ================================
CREATE TABLE IF NOT EXISTS denominations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
    note_value NUMERIC(10,2) NOT NULL CHECK (note_value > 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_denomination UNIQUE (restaurant_id, business_day_id, note_value)
);

CREATE INDEX IF NOT EXISTS idx_denominations_day ON denominations(business_day_id);
CREATE INDEX IF NOT EXISTS idx_denominations_restaurant ON denominations (restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_drawer ON denominations(restaurant_id, business_day_id, note_value);

-- ================================
-- CASH WITHDRAWALS
-- ================================
CREATE TABLE IF NOT EXISTS cash_withdrawals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    user_id BIGINT REFERENCES users(id),
    partner_id INT REFERENCES partners(id),
    reason withdrawal_reason,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- CASH DEPOSITS
-- ================================
CREATE TABLE IF NOT EXISTS cash_deposits (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    user_id BIGINT REFERENCES users(id),
    partner_id INT REFERENCES partners(id),
    reason TEXT,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- VENDORS
-- ================================
CREATE TABLE IF NOT EXISTS vendors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    description TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_vendor_per_restaurant ON vendors (restaurant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_vendors_restaurant ON vendors(restaurant_id);

-- ================================
-- VENDOR SETTLEMENTS
-- ================================
CREATE TABLE IF NOT EXISTS vendor_settlements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE CASCADE,
    business_day_id BIGINT REFERENCES business_days(id),
    total_due NUMERIC(10,2) NOT NULL CHECK (total_due >= 0),
    total_paid NUMERIC(10,2) NOT NULL CHECK (total_paid >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'online', 'card')),
    withdrawal_id BIGINT REFERENCES cash_withdrawals(id),
    partner_id INT REFERENCES partners(id),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_settlements_restaurant ON vendor_settlements(restaurant_id);

-- ================================
-- EXPENSES
-- ================================
CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT REFERENCES business_days(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    description TEXT,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'online')),
    user_id BIGINT REFERENCES users(id),
    vendor_id BIGINT REFERENCES vendors(id) ON DELETE RESTRICT,
    settlement_id BIGINT REFERENCES vendor_settlements(id),
    staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    partner_id INT REFERENCES partners(id),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_at TIMESTAMP,
    paid_by BIGINT REFERENCES users(id),
    deduct_from_galla BOOLEAN NOT NULL DEFAULT FALSE,
    document_url TEXT,
    source TEXT DEFAULT 'manual',
    expense_date DATE,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_settlement_once UNIQUE (id, settlement_id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_restaurant ON expenses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_partner ON expenses(partner_id);

-- ================================
-- CASH LEDGER
-- ================================
CREATE TABLE IF NOT EXISTS cash_ledger (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    business_day_id BIGINT NOT NULL REFERENCES business_days(id) ON DELETE CASCADE,
    type ledger_type NOT NULL,
    reference_id BIGINT,
    amount NUMERIC(10,2) NOT NULL,
    is_reversal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_day ON cash_ledger(business_day_id);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_restaurant ON cash_ledger(restaurant_id);

-- ================================
-- STAFF
-- ================================
CREATE TABLE IF NOT EXISTS staff (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    salary NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joining_date DATE DEFAULT CURRENT_DATE,
    salary_cycle TEXT DEFAULT 'monthly',
    user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON staff(restaurant_id);

CREATE TABLE IF NOT EXISTS staff_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    staff_id BIGINT REFERENCES staff(id),
    amount NUMERIC(10,2) NOT NULL,
    type TEXT CHECK (type IN ('payment', 'adjustment')),
    reason TEXT,
    business_day_id BIGINT REFERENCES business_days(id),
    withdrawal_id BIGINT REFERENCES cash_withdrawals(id),
    expense_id INTEGER REFERENCES expenses(id),
    payment_method TEXT,
    deduct_from_galla BOOLEAN NOT NULL DEFAULT FALSE,
    salary_month DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_transactions_expense_id ON staff_transactions(expense_id);
CREATE INDEX IF NOT EXISTS idx_staff_transactions_restaurant ON staff_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_txn ON staff_transactions (restaurant_id, created_at);

CREATE TABLE IF NOT EXISTS staff_roster (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    staff_id BIGINT REFERENCES staff(id),
    date DATE NOT NULL,
    shift_start TIME,
    shift_end TIME,
    created_by BIGINT REFERENCES users(id)
);

-- ================================
-- PARTNERS
-- ================================
CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    share_percent NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT partner_share_check CHECK (share_percent > 0 AND share_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_partners_restaurant ON partners(restaurant_id);

-- ================================
-- PARTNER LEDGER
-- ================================
CREATE TABLE IF NOT EXISTS partner_ledger (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    partner_id INT REFERENCES partners(id) ON DELETE CASCADE,
    type TEXT,
    reference_id INT,
    amount NUMERIC,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT partner_ledger_type_check CHECK (
        type IN ('withdrawal', 'deposit', 'expense', 'settlement', 'profit')
    )
);

CREATE INDEX IF NOT EXISTS idx_partner_ledger_restaurant ON partner_ledger(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner ON partner_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_type ON partner_ledger(type);

-- ================================
-- RESTAURANT SETTINGS
-- ================================
CREATE TABLE IF NOT EXISTS restaurant_settings (
    restaurant_id INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
    use_business_day BOOLEAN DEFAULT TRUE,
    enable_cash_recount BOOLEAN DEFAULT TRUE,
    allow_staff_print BOOLEAN DEFAULT TRUE,
    enable_vendor_ledger BOOLEAN DEFAULT TRUE,
    enable_customer_ledger BOOLEAN DEFAULT TRUE,
    enable_email BOOLEAN DEFAULT FALSE,
    enable_partners BOOLEAN DEFAULT FALSE,
    enable_manual_change BOOLEAN DEFAULT FALSE,
    use_payroll BOOLEAN DEFAULT FALSE,
    payroll_provider TEXT NULL,
    currency_code VARCHAR(3) DEFAULT 'AUD',
    currency_symbol VARCHAR(5) DEFAULT '$',
    currency_locale VARCHAR(10) DEFAULT 'en-AU',
    payid TEXT,
    payid_name TEXT,
    eftpos_provider TEXT DEFAULT NULL,
    eftpos_api_key TEXT DEFAULT NULL,
    eftpos_merchant_id TEXT DEFAULT NULL,
    eftpos_terminal_id TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- COMMUNICATION SETTINGS
-- ================================
CREATE TABLE IF NOT EXISTS communication_settings (
    restaurant_id INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
    send_bill_email BOOLEAN DEFAULT FALSE,
    notify_owner_email BOOLEAN DEFAULT FALSE,
    owner_email TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_settings_restaurant ON communication_settings(restaurant_id);

-- ================================
-- ACTIVITY LOGS
-- ================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id INT,
    action TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_restaurant ON activity_logs(restaurant_id);

-- ================================
-- BANK ACCOUNTS
-- ================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL,
    name TEXT NOT NULL,
    account_number TEXT,
    account_holder TEXT,
    bsb TEXT,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- BANK TRANSACTIONS
-- ================================
CREATE TABLE IF NOT EXISTS bank_transactions (
    id SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL,
    bank_account_id INT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT CHECK (type IN ('credit', 'debit')),
    source TEXT,
    reference_id INT,
    description TEXT,
    partner_id BIGINT,
    created_by BIGINT,
    idempotency_key TEXT,
    is_reversal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_idempotency ON bank_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_idempotency_per_restaurant ON bank_transactions (restaurant_id, idempotency_key);

-- ================================
-- PAY TYPES
-- ================================
CREATE TABLE IF NOT EXISTS pay_types (
    id SERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate_multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (rate_multiplier > 0),
    base_rate NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_pay_type_name_per_restaurant ON pay_types (restaurant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_pay_types_restaurant ON pay_types(restaurant_id);

-- ================================
-- SHIFTS
-- ================================
CREATE TABLE IF NOT EXISTS shifts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    date DATE NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    pay_type_id INT REFERENCES pay_types(id),
    base_rate NUMERIC(10,2),
    overtime_rate NUMERIC(10,2),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT check_base_rate CHECK (base_rate >= 0),
    CONSTRAINT check_overtime_rate CHECK (overtime_rate >= 0),
    CONSTRAINT unique_shift_restaurant UNIQUE (restaurant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_shifts_restaurant_date ON shifts (restaurant_id, date);

-- ================================
-- SHIFT ASSIGNMENTS
-- ================================
CREATE TABLE IF NOT EXISTS shift_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    shift_id BIGINT REFERENCES shifts(id) ON DELETE CASCADE,
    staff_id BIGINT REFERENCES staff(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (shift_id, staff_id),
    CONSTRAINT fk_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shift_time ON shift_assignments (restaurant_id, start_time);

-- ================================
-- SHIFT LOGS
-- ================================
CREATE TABLE IF NOT EXISTS shift_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    scheduled_start TIME,
    scheduled_end TIME,
    actual_hours NUMERIC(6,2) CHECK (actual_hours >= 0),
    pay_rate NUMERIC(10,2) CHECK (pay_rate >= 0),
    overtime_rate NUMERIC(10,2) CHECK (overtime_rate >= 0),
    total_earnings NUMERIC(10,2) DEFAULT 0 CHECK (total_earnings >= 0),
    paid_amount NUMERIC(10,2) DEFAULT 0 CHECK (paid_amount >= 0),
    remaining_amount NUMERIC(10,2) DEFAULT 0 CHECK (remaining_amount >= 0),
    latitude NUMERIC,
    longitude NUMERIC,
    clock_in_location_text TEXT,
    clock_in_place_id TEXT,
    clock_out_location_text TEXT,
    clock_out_place_id TEXT,
    is_auto_closed BOOLEAN DEFAULT FALSE,
    status TEXT CHECK (status IN ('active', 'completed', 'auto_closed')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT shift_logs_amount_check CHECK (remaining_amount = total_earnings - paid_amount)
);

CREATE INDEX IF NOT EXISTS idx_shift_logs_restaurant ON shift_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_staff ON shift_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_shift ON shift_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_logs_active ON shift_logs(status);
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_shift_per_staff ON shift_logs(staff_id) WHERE status = 'active';

-- ================================
-- CASH RECOUNTS
-- ================================
CREATE TABLE IF NOT EXISTS cash_recounts (
    id SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL,
    business_day_id INT REFERENCES business_days(id),
    user_id INT REFERENCES users(id),
    total NUMERIC NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- BILL SEQUENCES
-- ================================
CREATE TABLE IF NOT EXISTS bill_sequences (
    restaurant_id INT NOT NULL,
    business_day_id INT NOT NULL,
    last_seq INT NOT NULL DEFAULT 0,
    PRIMARY KEY (restaurant_id, business_day_id)
);

-- ================================
-- REFUNDS
-- ================================
CREATE TABLE IF NOT EXISTS refunds (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    idempotency_key TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_refund_order FOREIGN KEY (restaurant_id, order_id)
        REFERENCES orders (restaurant_id, id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_refund_idem'
    ) THEN
        ALTER TABLE refunds ADD CONSTRAINT unique_refund_idem UNIQUE (idempotency_key);
    END IF;
END $$;

-- ================================
-- REFUND ITEMS
-- ================================
CREATE TABLE IF NOT EXISTS refund_items (
    id SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL,
    order_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================
-- LEDGER EVENTS
-- ================================
CREATE TABLE IF NOT EXISTS ledger_events (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL,
    business_day_id BIGINT,
    entity_type TEXT,
    entity_id BIGINT,
    event_type TEXT,
    amount NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by BIGINT,
    CONSTRAINT ledger_event_type_check CHECK (
        event_type IN (
            'order_created',
            'cash_sale',
            'change_given',
            'cash_refund',
            'bank_refund',
            'refund',
            'order_deleted',
            'order_restored',
            'bank_credit',
            'bank_debit',
            'cash_withdrawal',
            'cash_deposit',
            'opening',
            'opening_balance',
            'closing_adjustment',
            'partner_created',
            'partner_updated',
            'partner_deleted'
        )
    ),
    CONSTRAINT ledger_entity_type_check CHECK (
        entity_type IN ('cash', 'bank', 'order')
    )
);

CREATE INDEX IF NOT EXISTS idx_ledger_restaurant_day ON ledger_events (restaurant_id, business_day_id);
CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON ledger_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entity ON ledger_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_events (created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_restaurant_entity ON ledger_events (restaurant_id, entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger_events (restaurant_id, entity_type, entity_id, event_type, created_at);

-- ================================
-- COMBOS
-- ================================
CREATE TABLE IF NOT EXISTS combos (
    id SERIAL PRIMARY KEY,
    restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    menu_item_id INT REFERENCES menu(id) ON DELETE CASCADE,
    combo_type TEXT NOT NULL DEFAULT 'volume',
    bundle_price NUMERIC(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS combo_tiers (
    id SERIAL PRIMARY KEY,
    combo_id INT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS combo_items (
    id SERIAL PRIMARY KEY,
    combo_id INT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    menu_item_id INT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1
);

-- Migrate existing single-item combos
INSERT INTO combo_items (combo_id, menu_item_id, quantity)
SELECT id, menu_item_id, 1 FROM combos WHERE menu_item_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
