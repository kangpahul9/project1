BEGIN;

-- ================================================================
-- PASSWORD RESET — token + expiry columns
-- ================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- ================================================================
-- MFA (TOTP) — secret stored per user, optional
-- ================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
