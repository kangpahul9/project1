BEGIN;

-- ================================
-- EXTENSIONS
-- ================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- ENUMS
-- ================================
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'withdrawal_reason') THEN
  CREATE TYPE withdrawal_reason AS ENUM (
    'Owner Personal','Supplier Payment','Bank Deposit','Petty Cash',
    'Staff Salary','Utilities','Emergency Expense',
    'Loan Repayment','Investment Transfer','Other'
  );
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_type') THEN
  CREATE TYPE ledger_type AS ENUM (
    'opening','sale','expense','withdrawal','closing_adjustment'
  );
END IF;
END $$;

-- ================================
-- RESTAURANTS
-- ================================
CREATE TABLE IF NOT EXISTS restaurants (
  id BIGSERIAL PRIMARY KEY,
  restaurant_uid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT '₹',
  receipt_footer TEXT DEFAULT 'Thank you 🙏 Visit Again',

  subscription_status TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_uid ON restaurants(restaurant_uid);

-- ================================
-- USERS
-- ================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','STAFF')),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (restaurant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(restaurant_id, email);

-- ================================
-- SETTINGS
-- ================================
CREATE TABLE IF NOT EXISTS restaurant_settings (
  restaurant_id INT PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,

  use_business_day BOOLEAN DEFAULT TRUE,
  enable_cash_recount BOOLEAN DEFAULT TRUE,
  allow_staff_print BOOLEAN DEFAULT TRUE,

  enable_vendor_ledger BOOLEAN DEFAULT TRUE,
  enable_customer_ledger BOOLEAN DEFAULT TRUE,

  enable_whatsapp BOOLEAN DEFAULT FALSE,
  enable_email BOOLEAN DEFAULT FALSE,

  enable_partners BOOLEAN DEFAULT FALSE,
  upi_id TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communication_settings (
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

-- ================================
-- BUSINESS DAYS
-- ================================
CREATE TABLE IF NOT EXISTS business_days (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  date DATE NOT NULL,
  opening_cash NUMERIC DEFAULT 0,
  closing_cash NUMERIC,
  is_closed BOOLEAN DEFAULT FALSE,

  opened_by BIGINT REFERENCES users(id),
  closed_by BIGINT REFERENCES users(id),

  closing_difference NUMERIC DEFAULT 0,
  closing_reason TEXT,
  has_discrepancy BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (restaurant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_business_days_restaurant_date
ON business_days (restaurant_id, date);

-- ================================
-- MENU
-- ================================
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  is_active BOOLEAN DEFAULT TRUE,

  UNIQUE (restaurant_id, LOWER(name))
);

CREATE TABLE IF NOT EXISTS menu (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  category_id INT REFERENCES menu_categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  usage_count NUMERIC DEFAULT 0,
  is_weight_based BOOLEAN DEFAULT FALSE,

  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu(restaurant_id);

-- ================================
-- ORDERS
-- ================================
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  business_day_id BIGINT,
  user_id BIGINT REFERENCES users(id),

  customer_name TEXT,
  customer_phone TEXT,

  payment_method TEXT,
  total NUMERIC NOT NULL CHECK (total >= 0),

  is_paid BOOLEAN DEFAULT TRUE,
  amount_paid NUMERIC DEFAULT 0,
  due_amount NUMERIC DEFAULT 0,

  bill_number TEXT,
  bill_seq INTEGER,
  discount NUMERIC DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (restaurant_id, bill_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_day_restaurant ON orders(restaurant_id, business_day_id);

-- ================================
-- ORDER ITEMS
-- ================================
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT,
  item_name TEXT,
  quantity NUMERIC(10,3),
  price NUMERIC,
  price_snapshot NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);

-- ================================
-- ORDER PAYMENTS
-- ================================
CREATE TABLE IF NOT EXISTS order_payments (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT,
  amount NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_order_payments_restaurant ON order_payments(restaurant_id);

-- ================================
-- DENOMINATIONS
-- ================================
CREATE TABLE IF NOT EXISTS denominations (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  business_day_id BIGINT NOT NULL REFERENCES business_days(id),
  note_value INT,
  quantity INT,
  UNIQUE (restaurant_id, business_day_id, note_value)
);

CREATE INDEX IF NOT EXISTS idx_denominations_restaurant ON denominations(restaurant_id);

-- ================================
-- CASH FLOW
-- ================================
CREATE TABLE IF NOT EXISTS cash_withdrawals (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  business_day_id BIGINT,
  amount NUMERIC,
  user_id BIGINT,
  reason withdrawal_reason,
  description TEXT,
  partner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_deposits (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  business_day_id BIGINT,
  amount NUMERIC,
  user_id BIGINT,
  reason TEXT,
  description TEXT,
  partner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_ledger (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  business_day_id BIGINT,
  type ledger_type,
  reference_id BIGINT,
  amount NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_restaurant ON cash_ledger(restaurant_id);

-- ================================
-- VENDORS
-- ================================
CREATE TABLE IF NOT EXISTS vendors (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  phone TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (restaurant_id, LOWER(name))
);

CREATE INDEX IF NOT EXISTS idx_vendors_restaurant ON vendors(restaurant_id);

-- ================================
-- EXPENSES
-- ================================
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  business_day_id BIGINT,
  amount NUMERIC NOT NULL,
  category TEXT,
  description TEXT,
  payment_method TEXT,
  vendor_id BIGINT,
  staff_id BIGINT,
  partner_id INT,

  is_paid BOOLEAN DEFAULT FALSE,
  amount_paid NUMERIC DEFAULT 0,
  paid_at TIMESTAMP,
  paid_by BIGINT,

  deduct_from_galla BOOLEAN DEFAULT FALSE,
  document_url TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_restaurant ON expenses(restaurant_id);

-- ================================
-- STAFF
-- ================================
CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  name TEXT,
  phone TEXT,
  salary NUMERIC,
  joining_date DATE DEFAULT CURRENT_DATE,
  salary_cycle TEXT DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON staff(restaurant_id);

CREATE TABLE IF NOT EXISTS staff_transactions (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  staff_id BIGINT,
  amount NUMERIC,
  type TEXT,
  reason TEXT,
  business_day_id BIGINT,
  payment_method TEXT,
  salary_month DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_transactions_restaurant ON staff_transactions(restaurant_id);

-- ================================
-- SHIFTS
-- ================================
CREATE TABLE IF NOT EXISTS shifts (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  date DATE,
  shift_start TIME,
  shift_end TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  shift_id BIGINT REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id BIGINT REFERENCES staff(id) ON DELETE CASCADE,

  UNIQUE (shift_id, staff_id)
);

-- ================================
-- BANK
-- ================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  restaurant_id INT,
  name TEXT,
  account_number TEXT,
  ifsc TEXT,
  account_holder TEXT,
  balance NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id SERIAL PRIMARY KEY,
  restaurant_id INT,
  bank_account_id INT,
  amount NUMERIC,
  type TEXT,
  source TEXT,
  reference_id INT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- PARTNERS
-- ================================
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  restaurant_id INT,
  name TEXT,
  phone TEXT,
  email TEXT,
  share_percent NUMERIC CHECK (share_percent > 0 AND share_percent <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_ledger (
  id SERIAL PRIMARY KEY,
  restaurant_id INT,
  partner_id INT,
  type TEXT CHECK (type IN ('withdrawal','deposit','expense','settlement','profit')),
  amount NUMERIC,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- LOGS
-- ================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  restaurant_id INT,
  user_id INT,
  action TEXT,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- CASH RECOUNT
-- ================================
CREATE TABLE IF NOT EXISTS cash_recounts (
  id SERIAL PRIMARY KEY,
  restaurant_id INT,
  total NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

CREATE TABLE IF NOT EXISTS vendor_settlements (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),

  vendor_id BIGINT NOT NULL REFERENCES vendors(id),
  business_day_id BIGINT REFERENCES business_days(id),

  total_due NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,

  payment_method TEXT CHECK (
    payment_method IN ('cash','card','online')
  ),

  withdrawal_id BIGINT REFERENCES cash_withdrawals(id),
  partner_id INT REFERENCES partners(id),

  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_settlements_restaurant
ON vendor_settlements(restaurant_id);

ALTER TABLE expenses
ADD COLUMN settlement_id BIGINT REFERENCES vendor_settlements(id);

ALTER TABLE orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IN (
    'cash',
    'card',
    'online',
    'unpaid',
    'mixed',
    'mixed-card',
    'mixed-online'
  )
);

ALTER TABLE expenses
ADD CONSTRAINT expenses_payment_method_check
CHECK (
  payment_method IN ('cash','card','online')
);

ALTER TABLE bank_transactions
ADD CONSTRAINT bank_txn_type_check
CHECK (type IN ('credit','debit'));

ALTER TABLE order_payments
ADD CONSTRAINT order_payments_restaurant_match
FOREIGN KEY (restaurant_id, order_id)
REFERENCES orders (restaurant_id, id);

ALTER TABLE orders
ADD CONSTRAINT orders_day_match
FOREIGN KEY (restaurant_id, business_day_id)
REFERENCES business_days (restaurant_id, id);

ALTER TABLE vendor_settlements
ADD COLUMN note TEXT;

-- staff transactions linking
ALTER TABLE staff_transactions
ADD COLUMN expense_id BIGINT REFERENCES expenses(id);

ALTER TABLE staff_transactions
ADD COLUMN withdrawal_id BIGINT REFERENCES cash_withdrawals(id);

-- expense source tracking
ALTER TABLE expenses
ADD COLUMN source TEXT DEFAULT 'manual';

-- shift accountability
ALTER TABLE shifts
ADD COLUMN created_by BIGINT REFERENCES users(id);

-- performance indexes
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at);



-- ================================
-- DATA SAFETY CONSTRAINTS
-- ================================

-- 1. staff_transactions type constraint
DO $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint 
  WHERE conname = 'staff_txn_type_check'
) THEN
  ALTER TABLE staff_transactions
  ADD CONSTRAINT staff_txn_type_check
  CHECK (type IN ('payment','adjustment'));
END IF;
END $$;


-- 2. cash_withdrawals amount check
DO $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint 
  WHERE conname = 'cash_withdrawals_amount_check'
) THEN
  ALTER TABLE cash_withdrawals
  ADD CONSTRAINT cash_withdrawals_amount_check
  CHECK (amount > 0);
END IF;
END $$;


-- 3. cash_deposits amount check
DO $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint 
  WHERE conname = 'cash_deposits_amount_check'
) THEN
  ALTER TABLE cash_deposits
  ADD CONSTRAINT cash_deposits_amount_check
  CHECK (amount > 0);
END IF;
END $$;


-- 4. order_payments amount check
DO $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint 
  WHERE conname = 'order_payments_amount_check'
) THEN
  ALTER TABLE order_payments
  ADD CONSTRAINT order_payments_amount_check
  CHECK (amount > 0);
END IF;
END $$;


-- ================================
-- PRECISION FIXES (FINANCIAL SAFETY)
-- ================================

-- business_days precision
ALTER TABLE business_days
ALTER COLUMN opening_cash TYPE NUMERIC(12,2);

ALTER TABLE business_days
ALTER COLUMN closing_cash TYPE NUMERIC(12,2);

ALTER TABLE business_days
ALTER COLUMN closing_difference TYPE NUMERIC(12,2);


-- ================================
-- OPTIONAL (BUT STRONG) AUDIT IMPROVEMENTS
-- ================================

-- vendors.created_by
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id);


-- ================================
-- OPTIONAL INDEXES (SCALING)
-- ================================

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone 
ON orders(customer_phone);

CREATE INDEX IF NOT EXISTS idx_orders_created_at 
ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at
ON expenses(created_at);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_day
ON cash_ledger(business_day_id);


-- ================================
-- UPDATED_AT AUTO TRIGGER (IMPORTANT)
-- ================================

-- function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- apply to restaurants
DROP TRIGGER IF EXISTS set_updated_at_restaurants ON restaurants;

CREATE TRIGGER set_updated_at_restaurants
BEFORE UPDATE ON restaurants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- apply to settings
DROP TRIGGER IF EXISTS set_updated_at_settings ON restaurant_settings;

CREATE TRIGGER set_updated_at_settings
BEFORE UPDATE ON restaurant_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- apply to communication_settings
DROP TRIGGER IF EXISTS set_updated_at_comm_settings ON communication_settings;

CREATE TRIGGER set_updated_at_comm_settings
BEFORE UPDATE ON communication_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE cash_withdrawals
ALTER COLUMN amount SET NOT NULL;

ALTER TABLE order_payments
ALTER COLUMN amount SET NOT NULL;

ALTER TABLE expenses
ALTER COLUMN amount SET NOT NULL;

ALTER TABLE staff_transactions
ADD CONSTRAINT staff_txn_restaurant_match
FOREIGN KEY (restaurant_id, staff_id)
REFERENCES staff (restaurant_id, id);

ALTER TABLE cash_ledger
ADD CONSTRAINT cash_ledger_amount_check
CHECK (amount != 0);