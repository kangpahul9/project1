import express from "express";
import jwt from "jsonwebtoken";
import { findUserByPin } from "../services/userService.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: "PIN required" });
    }

    const user = await findUserByPin(pin);

    if (!user) {
      return res.status(401).json({ message: "Invalid PIN" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      userId: user.id,
      name: user.name,
      role: user.role,
      token
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
