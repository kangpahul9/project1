-- KangPOS Migration 4 — Ensure all restaurant_settings columns exist
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)
-- Run: psql -h <host> -U postgres -d kangpos_prod -f migrate4.sql

BEGIN;

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS enable_partners      BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS enable_manual_change  BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS use_payroll           BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payroll_provider      TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_code         VARCHAR(3) DEFAULT 'AUD';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_symbol       VARCHAR(5) DEFAULT '$';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS currency_locale       VARCHAR(10) DEFAULT 'en-AU';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS upi_id                TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payid                 TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS payid_name            TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_provider       TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_api_key        TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_merchant_id    TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS eftpos_terminal_id    TEXT;

ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS send_bill_whatsapp     BOOLEAN DEFAULT FALSE;
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS notify_owner_whatsapp  BOOLEAN DEFAULT FALSE;
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS owner_phone            TEXT;

COMMIT;
