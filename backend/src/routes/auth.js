import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { findUserByEmail } from "../services/userService.js";

const router = express.Router();

const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8b0l5lHppZArYdS4x2QVWwtIg9Y9iG";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

/* =========================================
   LOGIN
========================================= */
router.post("/login", async (req, res, next) => {
  try {
    let { restaurantUid, email, password } = req.body;

    // 🔒 Validate input types
    if (
      !restaurantUid ||
      typeof restaurantUid !== "string" ||
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid input",
      });
    }

    // 🔒 Normalize input
    restaurantUid = restaurantUid.trim();
    email = email.trim().toLowerCase();
    password = password.trim();

    const user = await findUserByEmail(restaurantUid, email);

    // 🔒 Prevent timing attacks
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);

      req.log?.warn(
        { email, restaurantUid, ip: req.headers["x-forwarded-for"] || req.ip },
        "Login failed: user not found"
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        message: "Account disabled. Contact admin.",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      req.log?.warn(
        { email, restaurantUid, ip: req.headers["x-forwarded-for"] || req.ip },
        "Login failed: wrong password"
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🔐 JWT
    const token = jwt.sign(
      {
        id: user.id,
        sub: user.id,
        role: user.role,
        restaurantId: user.restaurant_id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
        issuer: "kangpos",
        audience: "kangpos-users",
      }
    );

    req.log?.info(
      { userId: user.id, restaurantId: user.restaurant_id },
      "Login success"
    );

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

export default router;