import express from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { handleAIQuery } from "../ai/aiService.js";

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many AI requests. Try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/chat", aiLimiter, authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { message } = req.body;
    const { restaurantId, userId } = req;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI not configured. Add OPENAI_API_KEY to .env",
      });
    }

    const result = await handleAIQuery({
      question: message.slice(0, 500),
      restaurantId,
      userId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
