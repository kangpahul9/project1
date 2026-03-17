import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { findUserByEmail } from "../services/userService.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { restaurantUid, email, password } = req.body;

    if (!restaurantUid || !email || !password) {
      return res.status(400).json({ message: "Restaurant ID, email and password required" });
    }

    const user = await findUserByEmail(restaurantUid, email);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        restaurantId: user.restaurant_id
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      userId: user.id,
      name: user.name,
      role: user.role,
      restaurantId: user.restaurant_id,
      token
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;