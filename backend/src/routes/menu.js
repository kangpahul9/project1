import express from "express";
import { getAllMenu, addMenuItem } from "../services/menuService.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const menu = await getAllMenu();
  res.json(menu);
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  const { name, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const item = await addMenuItem(name, price);
  res.status(201).json(item);
});

export default router;
