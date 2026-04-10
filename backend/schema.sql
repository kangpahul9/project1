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

ALTER TABLE staff_transactions
ADD COLUMN salary_month DATE;

CREATE TABLE menu_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  sort_order INT DEFAULT 0
);

ALTER TABLE menu
ADD COLUMN category_id INT REFERENCES menu_categories(id);

CREATE INDEX idx_menu_category
ON menu(category_id);

ALTER TABLE menu_categories
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE menu
ADD COLUMN usage_count INT DEFAULT 0;

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IN (
    'cash',
    'online',
    'card',
    'unpaid',
    'mixed'
  )
);

CREATE TABLE order_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('cash','card','online')
  ),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_payments_order
ON order_payments(order_id);

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IN (
    'cash',
    'online',
    'card',
    'unpaid',
    'mixed-card',
    'mixed-online'
  )
);

INSERT INTO order_payments (order_id, payment_method, amount)
SELECT
o.id,
o.payment_method,
o.total
FROM orders o
WHERE o.payment_method IN ('cash','card','online')
AND NOT EXISTS (
  SELECT 1
  FROM order_payments op
  WHERE op.order_id = o.id
);

ALTER TABLE orders
ADD COLUMN discount NUMERIC(10,2) DEFAULT 0;

CREATE TABLE restaurants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_uid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE users
ADD COLUMN email TEXT UNIQUE;

ALTER TABLE users
ADD COLUMN password_hash TEXT;

ALTER TABLE users
DROP COLUMN pin;

CREATE INDEX idx_users_restaurant
ON users(restaurant_id);

ALTER TABLE menu
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE orders
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE vendors
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE expenses
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE staff
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE business_days
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE cash_withdrawals
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE cash_deposits
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE menu DROP CONSTRAINT IF EXISTS menu_name_key;

ALTER TABLE menu
ADD CONSTRAINT unique_menu_name_per_restaurant
UNIQUE (restaurant_id, name);

DROP INDEX IF EXISTS unique_vendor_name;

CREATE UNIQUE INDEX unique_vendor_per_restaurant
ON vendors (restaurant_id, LOWER(name));

ALTER TABLE users
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE menu
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE orders
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE vendors
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE expenses
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE staff
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE business_days
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE cash_withdrawals
ALTER COLUMN restaurant_id SET NOT NULL;
ALTER TABLE cash_deposits
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE order_items
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE order_items
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE denominations
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE denominations
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE vendor_settlements
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE vendor_settlements
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE cash_ledger
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE cash_ledger
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE staff_transactions
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE staff_transactions
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE staff_roster
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE staff_roster
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE menu_categories
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE menu_categories
ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE order_payments
ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id);

ALTER TABLE order_payments
ALTER COLUMN restaurant_id SET NOT NULL;

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_menu_restaurant ON menu(restaurant_id);
CREATE INDEX idx_expenses_restaurant ON expenses(restaurant_id);
CREATE INDEX idx_staff_restaurant ON staff(restaurant_id);
CREATE INDEX idx_business_days_restaurant ON business_days(restaurant_id);
CREATE INDEX idx_vendors_restaurant ON vendors(restaurant_id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX unique_user_email_per_restaurant
ON users (restaurant_id, email);

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_bill_number_key;

CREATE UNIQUE INDEX unique_bill_per_restaurant
ON orders (restaurant_id, bill_number);

ALTER TABLE business_days
DROP CONSTRAINT IF EXISTS business_days_date_key;

CREATE UNIQUE INDEX unique_business_day_per_restaurant
ON business_days (restaurant_id, date);

ALTER TABLE denominations
DROP CONSTRAINT IF EXISTS denominations_business_day_id_note_value_key;

CREATE UNIQUE INDEX unique_denomination_per_day
ON denominations (restaurant_id, business_day_id, note_value);

CREATE INDEX idx_order_items_restaurant
ON order_items(restaurant_id);

CREATE INDEX idx_order_payments_restaurant
ON order_payments(restaurant_id);

CREATE INDEX idx_cash_ledger_restaurant
ON cash_ledger(restaurant_id);

CREATE INDEX idx_staff_transactions_restaurant
ON staff_transactions(restaurant_id);

CREATE INDEX idx_vendor_settlements_restaurant
ON vendor_settlements(restaurant_id);
CREATE UNIQUE INDEX unique_category_per_restaurant
ON menu_categories (restaurant_id, LOWER(name));

CREATE INDEX idx_restaurant_uid
ON restaurants(restaurant_uid);

ALTER TABLE users
ALTER COLUMN email SET NOT NULL;

ALTER TABLE users
ALTER COLUMN password_hash SET NOT NULL;

DROP INDEX IF EXISTS unique_bill_per_restaurant;

CREATE UNIQUE INDEX unique_bill_per_restaurant
ON orders (restaurant_id, bill_number)
WHERE bill_number IS NOT NULL;

CREATE INDEX idx_users_login
ON users (restaurant_id, email);

CREATE INDEX idx_denominations_restaurant
ON denominations (restaurant_id);


ALTER TABLE orders
ADD CONSTRAINT unique_order_per_restaurant
UNIQUE (restaurant_id, id);

ALTER TABLE order_payments
ADD CONSTRAINT order_payments_restaurant_match
FOREIGN KEY (restaurant_id, order_id)
REFERENCES orders (restaurant_id, id);

CREATE INDEX idx_business_day_restaurant_date
ON business_days (restaurant_id, date);

DROP INDEX IF EXISTS unique_category_per_restaurant;

CREATE UNIQUE INDEX unique_category_per_restaurant
ON menu_categories (restaurant_id, LOWER(name));

ALTER TABLE business_days
ADD CONSTRAINT unique_business_day_restaurant
UNIQUE (restaurant_id, id);

ALTER TABLE orders
ADD CONSTRAINT orders_day_match
FOREIGN KEY (restaurant_id, business_day_id)
REFERENCES business_days (restaurant_id, id);

CREATE INDEX idx_orders_day_restaurant
ON orders (restaurant_id, business_day_id);

CREATE UNIQUE INDEX uniq_drawer
ON denominations(restaurant_id, business_day_id, note_value);

ALTER TABLE orders
ADD COLUMN bill_seq INTEGER;

CREATE TABLE restaurant_settings (
  restaurant_id INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,

  use_business_day BOOLEAN DEFAULT TRUE,
  enable_cash_recount BOOLEAN DEFAULT TRUE,
  allow_staff_print BOOLEAN DEFAULT TRUE,

  enable_vendor_ledger BOOLEAN DEFAULT TRUE,
  enable_customer_ledger BOOLEAN DEFAULT TRUE,

  enable_whatsapp BOOLEAN DEFAULT FALSE,
  enable_email BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE partners (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  share_percent NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE communication_settings (
  restaurant_id INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,

  send_bill_whatsapp BOOLEAN DEFAULT FALSE,
  send_bill_email BOOLEAN DEFAULT FALSE,

  notify_owner_whatsapp BOOLEAN DEFAULT FALSE,
  notify_owner_email BOOLEAN DEFAULT FALSE,

  owner_phone TEXT,
  owner_email TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE restaurants
ADD COLUMN address TEXT,
ADD COLUMN email TEXT,
ADD COLUMN logo_url TEXT,
ADD COLUMN currency TEXT DEFAULT '₹',
ADD COLUMN receipt_footer TEXT DEFAULT 'Thank you 🙏 Visit Again',
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE restaurant_settings
ADD COLUMN enable_partners BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_comm_settings_restaurant
ON communication_settings(restaurant_id);

CREATE TABLE partner_ledger (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  partner_id INT REFERENCES partners(id) ON DELETE CASCADE,

  type TEXT, -- profit, expense, withdrawal
  reference_id INT,

  amount NUMERIC,
  note TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id INT,

  action TEXT,
  message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE partners
ADD CONSTRAINT partner_share_check
CHECK (share_percent > 0 AND share_percent <= 100);

CREATE INDEX idx_partners_restaurant
ON partners(restaurant_id);

CREATE INDEX idx_partner_ledger_restaurant
ON partner_ledger(restaurant_id);

CREATE INDEX idx_activity_logs_restaurant
ON activity_logs(restaurant_id);

CREATE TABLE cash_recounts (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE denominations
ADD CONSTRAINT unique_denomination
UNIQUE (restaurant_id, business_day_id, note_value);

ALTER TABLE cash_withdrawals
ADD COLUMN partner_id INT REFERENCES partners(id);

ALTER TABLE cash_deposits
ADD COLUMN partner_id INT REFERENCES partners(id);

ALTER TABLE expenses
ADD COLUMN partner_id INT REFERENCES partners(id);

ALTER TABLE vendor_settlements
ADD COLUMN partner_id INT REFERENCES partners(id);

ALTER TABLE partner_ledger
ADD CONSTRAINT partner_ledger_type_check
CHECK (
  type IN ('withdrawal','deposit','expense','settlement','profit')
);

CREATE INDEX idx_partner_ledger_partner
ON partner_ledger(partner_id);

CREATE INDEX idx_partner_ledger_type
ON partner_ledger(type);

CREATE INDEX idx_expenses_partner
ON expenses(partner_id);

CREATE TABLE bank_accounts (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name TEXT NOT NULL,        -- e.g. HDFC Current
  account_number TEXT,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bank_transactions (
  id SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL,
  bank_account_id INT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('credit','debit')),
  source TEXT, -- expense, order, vendor_settlement, etc
  reference_id INT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE bank_accounts
ADD COLUMN ifsc TEXT,
ADD COLUMN account_holder TEXT;

ALTER TABLE restaurant_settings
ADD COLUMN upi_id TEXT;

ALTER TABLE menu
ADD COLUMN is_weight_based BOOLEAN DEFAULT FALSE;

ALTER TABLE order_items
ALTER COLUMN quantity TYPE NUMERIC(10,2);

ALTER TABLE order_items
ALTER COLUMN quantity TYPE NUMERIC(10,3);

ALTER TABLE menu
ALTER COLUMN usage_count TYPE NUMERIC(10,3);

CREATE TABLE shifts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  date DATE NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shift_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  shift_id BIGINT REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id BIGINT REFERENCES staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (shift_id, staff_id) -- prevent duplicates
);


ALTER TABLE shift_assignments
ADD CONSTRAINT fk_shift
FOREIGN KEY (shift_id)
REFERENCES shifts(id)
ON DELETE CASCADE;

ALTER TABLE shifts
ADD CONSTRAINT unique_shift_restaurant
UNIQUE (restaurant_id, id);

CREATE INDEX idx_shifts_restaurant_date
ON shifts (restaurant_id, date);

ALTER TABLE restaurants ADD COLUMN subscription_status TEXT;
ALTER TABLE restaurants ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE restaurants ADD COLUMN stripe_subscription_id TEXT;

ALTER TABLE restaurants
ADD COLUMN subscription_valid_till TIMESTAMP;

ALTER TABLE expenses ADD COLUMN expense_date DATE;

ALTER TABLE orders
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

UPDATE orders
SET is_deleted = FALSE
WHERE is_deleted IS NULL;

ALTER TABLE cash_ledger 
ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN DEFAULT FALSE;

ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN DEFAULT FALSE;

CREATE TABLE order_denominations (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  business_day_id BIGINT NOT NULL,

  note_value INTEGER NOT NULL,
  quantity INTEGER NOT NULL,

  type TEXT CHECK (type IN ('received','change')),

  created_at TIMESTAMP DEFAULT NOW()
);

--> temp push after db changes, will remove after testing