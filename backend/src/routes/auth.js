import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { findUserByEmail } from "../services/userService.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { invalidateVersionCache } from "../middleware/authMiddleware.js";

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

export default router;
