import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/ai/aiService.js");

const { handleAIQuery } = require("../../src/ai/aiService.js");
import aiRouter from "../../src/routes/ai.js";

const SECRET = process.env.JWT_SECRET;
const adminToken = jwt.sign({ id: 1, restaurantId: 1, role: "ADMIN" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  next();
});
app.use("/ai", aiRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ error: err.message }));

beforeEach(() => handleAIQuery.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// POST /ai/chat
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /ai/chat", () => {
  test("returns AI response for valid message", async () => {
    handleAIQuery.mockResolvedValueOnce({ answer: "Revenue is $5000", sql: "SELECT 1" });
    const res = await request(app)
      .post("/ai/chat")
      .set(auth(adminToken))
      .send({ message: "What was today's revenue?" });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("Revenue is $5000");
    expect(handleAIQuery).toHaveBeenCalledWith(
      expect.objectContaining({ question: "What was today's revenue?", restaurantId: 1 })
    );
  });

  test("truncates message to 500 characters", async () => {
    handleAIQuery.mockResolvedValueOnce({ answer: "ok" });
    const longMsg = "B".repeat(600);
    await request(app).post("/ai/chat").set(auth(adminToken)).send({ message: longMsg });
    expect(handleAIQuery).toHaveBeenCalledWith(
      expect.objectContaining({ question: "B".repeat(500) })
    );
  });

  test("returns 400 when message is missing", async () => {
    const res = await request(app).post("/ai/chat").set(auth(adminToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/message required/i);
  });

  test("returns 400 when message is not a string", async () => {
    const res = await request(app)
      .post("/ai/chat")
      .set(auth(adminToken))
      .send({ message: 42 });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/ai/chat").send({ message: "hello" });
    expect(res.status).toBe(401);
  });

  test("propagates error from handleAIQuery to error handler", async () => {
    handleAIQuery.mockRejectedValueOnce(new Error("OpenAI unavailable"));
    const res = await request(app)
      .post("/ai/chat")
      .set(auth(adminToken))
      .send({ message: "test" });
    expect([400, 500]).toContain(res.status);
    expect(res.body.error).toMatch(/OpenAI unavailable/i);
  });
});
