import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { authenticator } from "../utils/otp.js";
import QRCode from "qrcode";
import pool from "../config/db.js";
import { findUserByEmail } from "../services/userService.js";
import { authenticate, invalidateVersionCache } from "../middleware/authMiddleware.js";
import { sendPasswordResetEmail, hashResetToken } from "../utils/email.js";

const router = express.Router();

const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8b0l5lHppZArYdS4x2QVWwtIg9Y9iG";

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

/* =========================================
   LOGIN
========================================= */
router.post("/login", async (req, res, next) => {
  try {
    let { restaurantUid, email, password } = req.body;

    if (
      !restaurantUid ||
      typeof restaurantUid !== "string" ||
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    restaurantUid = restaurantUid.trim();
    email = email.trim().toLowerCase();
    password = password.trim();

    const user = await findUserByEmail(restaurantUid, email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      req.log?.warn(
        { email, restaurantUid, ip: req.headers["x-forwarded-for"] || req.ip },
        "Login failed: user not found"
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const unlockAt = new Date(user.locked_until).toISOString();
      req.log?.warn({ email, userId: user.id }, "Login rejected: account locked");
      return res.status(429).json({
        message: `Account locked due to too many failed attempts. Try again after ${unlockAt}.`,
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({ message: "Account disabled. Contact admin." });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const newCount = (user.failed_login_count || 0) + 1;
      const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;

      await pool.query(
        `UPDATE users
         SET failed_login_count = $1,
             locked_until       = $2
         WHERE id = $3`,
        [
          newCount,
          shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
          user.id,
        ]
      );

      req.log?.warn(
        { email, restaurantUid, ip: req.headers["x-forwarded-for"] || req.ip, attempts: newCount },
        "Login failed: wrong password"
      );

      if (shouldLock) {
        return res.status(429).json({
          message: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        });
      }

      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Success — reset lockout counters
    await pool.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
      [user.id]
    );

    // MFA gate — if user has TOTP enabled, return a short-lived challenge token
    if (user.totp_enabled) {
      const mfaToken = jwt.sign(
        { mfaPending: true, userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }
      );
      return res.json({ mfaRequired: true, mfaToken });
    }

    const tokenVersion = user.token_version ?? 0;

    const token = jwt.sign(
      {
        id: user.id,
        sub: user.id,
        role: user.role,
        restaurantId: user.restaurant_id,
        tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", issuer: "kangpos", audience: "kangpos-users" }
    );

    req.log?.info({ userId: user.id, restaurantId: user.restaurant_id }, "Login success");

    return res.json({
      userId: user.id,
      name: user.name,
      role: user.role,
      restaurantId: user.restaurant_id,
      token,
    });
  } catch (err) {
    req.log?.error(err, "Login error");
    next(err);
  }
});

/* =========================================
   LOGOUT — invalidates the current token
========================================= */
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE users SET token_version = token_version + 1 WHERE id = $1",
      [req.userId]
    );
    invalidateVersionCache(req.userId);
    res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   MFA — COMPLETE LOGIN (step 2 with OTP)
   POST /auth/mfa/login  { mfaToken, code }
========================================= */
router.post("/mfa/login", async (req, res, next) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ message: "mfaToken and code required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired MFA token" });
    }

    if (!decoded.mfaPending) {
      return res.status(401).json({ message: "Invalid MFA token" });
    }

    const result = await pool.query(
      `SELECT u.*, r.id AS restaurant_id_val FROM users u
       LEFT JOIN restaurants r ON r.id = u.restaurant_id
       WHERE u.id = $1 AND u.is_active = TRUE LIMIT 1`,
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: "Invalid or expired MFA token" });
    }

    const user = result.rows[0];

    if (!user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ message: "MFA not configured" });
    }

    const valid = authenticator.verify({ token: String(code).trim(), secret: user.totp_secret });
    if (!valid) {
      return res.status(401).json({ message: "Invalid OTP code" });
    }

    const tokenVersion = user.token_version ?? 0;
    const token = jwt.sign(
      {
        id: user.id,
        sub: user.id,
        role: user.role,
        restaurantId: user.restaurant_id,
        tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", issuer: "kangpos", audience: "kangpos-users" }
    );

    req.log?.info({ userId: user.id }, "MFA login success");
    return res.json({
      userId: user.id,
      name: user.name,
      role: user.role,
      restaurantId: user.restaurant_id,
      token,
    });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   MFA — SETUP (generates secret + QR code)
   POST /auth/mfa/setup
========================================= */
router.post("/mfa/setup", authenticate, async (req, res, next) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(
      req.user.email || String(req.userId),
      "KangPOS",
      secret
    );
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Store secret (not yet enabled — user must verify first)
    await pool.query(
      "UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2",
      [secret, req.userId]
    );

    res.json({ qrCode: qrDataUrl, secret });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   MFA — VERIFY & ENABLE
   POST /auth/mfa/verify  { code }
========================================= */
router.post("/mfa/verify", authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "OTP code required" });
    }

    const result = await pool.query(
      "SELECT totp_secret FROM users WHERE id = $1",
      [req.userId]
    );
    const { totp_secret } = result.rows[0] || {};
    if (!totp_secret) {
      return res.status(400).json({ message: "MFA not set up — call /mfa/setup first" });
    }

    const valid = authenticator.verify({ token: code.trim(), secret: totp_secret });
    if (!valid) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    await pool.query("UPDATE users SET totp_enabled = TRUE WHERE id = $1", [req.userId]);
    res.json({ message: "MFA enabled" });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   MFA — DISABLE
   POST /auth/mfa/disable  { code }
========================================= */
router.post("/mfa/disable", authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "OTP code required to disable MFA" });
    }

    const result = await pool.query(
      "SELECT totp_secret, totp_enabled FROM users WHERE id = $1",
      [req.userId]
    );
    const { totp_secret, totp_enabled } = result.rows[0] || {};
    if (!totp_enabled) {
      return res.status(400).json({ message: "MFA is not enabled" });
    }

    const valid = authenticator.verify({ token: code.trim(), secret: totp_secret });
    if (!valid) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    await pool.query(
      "UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1",
      [req.userId]
    );
    res.json({ message: "MFA disabled" });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   MFA STATUS
   GET /auth/mfa/status
========================================= */
router.get("/mfa/status", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT totp_enabled FROM users WHERE id = $1",
      [req.userId]
    );
    res.json({ mfaEnabled: result.rows[0]?.totp_enabled ?? false });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   FORGOT PASSWORD
========================================= */
router.post("/forgot-password", async (req, res, next) => {
  try {
    let { restaurantUid, email } = req.body;

    if (
      !restaurantUid || typeof restaurantUid !== "string" ||
      !email || typeof email !== "string"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    restaurantUid = restaurantUid.trim();
    email = email.trim().toLowerCase();

    // Always return 200 to prevent user enumeration
    const GENERIC_OK = { message: "If that email exists, a reset link has been sent." };

    const result = await pool.query(
      `SELECT u.id, u.email, r.name AS restaurant_name
       FROM users u
       JOIN restaurants r ON r.id = u.restaurant_id
       WHERE r.uid = $1 AND u.email = $2 AND u.is_active = TRUE
       LIMIT 1`,
      [restaurantUid, email]
    );

    if (!result.rows.length) return res.json(GENERIC_OK);

    const user = result.rows[0];
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3`,
      [tokenHash, expires, user.id]
    );

    await sendPasswordResetEmail({
      toEmail: user.email,
      rawToken,
      restaurantName: user.restaurant_name,
    });

    res.json(GENERIC_OK);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   RESET PASSWORD
========================================= */
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== "string" || !password || typeof password !== "string") {
      return res.status(400).json({ message: "Invalid input" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = hashResetToken(token.trim());

    const result = await pool.query(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()
         AND is_active = TRUE
       LIMIT 1`,
      [tokenHash]
    );

    if (!result.rows.length) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const userId = result.rows[0].id;
    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           token_version = token_version + 1,
           failed_login_count = 0,
           locked_until = NULL
       WHERE id = $2`,
      [hashed, userId]
    );

    invalidateVersionCache(userId);

    res.json({ message: "Password reset successful. Please log in." });
  } catch (err) {
    next(err);
  }
});

export default router;
