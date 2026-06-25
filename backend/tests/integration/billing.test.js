import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");

// Factory creates fresh jest.fn() methods per constructor call.
// billing.js calls new Stripe() once at module load; we retrieve that instance
// via MockStripe.mock.results[0].value after billing.js has been imported.
jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
  }))
);

const pool = require("../../src/config/db.js").default;
import billingRouter from "../../src/routes/billing.js";

// billing.js already called new Stripe(key) during import above; grab that instance
const MockStripe = require("stripe");
const stripe = MockStripe.mock.results[0]?.value;

const SECRET = process.env.JWT_SECRET;
const adminToken = jwt.sign({ id: 1, restaurantId: 1, role: "ADMIN" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const app = express();
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  next();
});
app.use(express.json());
app.use("/billing", billingRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

beforeEach(() => {
  pool.query.mockReset();
  stripe?.checkout?.sessions?.create?.mockReset();
  stripe?.webhooks?.constructEvent?.mockReset();
  stripe?.subscriptions?.retrieve?.mockReset();
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /billing/subscription
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /billing/subscription", () => {
  test("returns subscription info for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ subscription_status: "active", subscription_valid_till: "2027-01-01" }],
    });
    const res = await request(app).get("/billing/subscription").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.subscription_status).toBe("active");
  });

  test("returns null when no subscription row found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/billing/subscription").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/billing/subscription");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /billing/create-checkout
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /billing/create-checkout", () => {
  test("creates Stripe checkout session and returns URL", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ email: "owner@test.com" }] });
    stripe.checkout.sessions.create.mockResolvedValueOnce({ url: "https://pay.stripe.com/abc123" });

    const res = await request(app)
      .post("/billing/create-checkout")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://pay.stripe.com/abc123");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription" })
    );
  });

  test("returns 400 when user email not found in DB", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post("/billing/create-checkout")
      .set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email not found/i);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/billing/create-checkout");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /billing/webhook
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /billing/webhook", () => {
  test("returns 400 when Stripe signature is invalid", async () => {
    stripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching");
    });
    const res = await request(app)
      .post("/billing/webhook")
      .set("stripe-signature", "bad_sig")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "test" }));
    expect(res.status).toBe(400);
  });

  test("handles checkout.session.completed and updates subscription", async () => {
    stripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          metadata: { restaurantId: "1" },
          customer: "cus_abc",
          subscription: "sub_xyz",
        },
      },
    });
    stripe.subscriptions.retrieve.mockResolvedValueOnce({
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/billing/webhook")
      .set("stripe-signature", "t=123,v1=abc")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE restaurants"),
      expect.arrayContaining(["cus_abc", "sub_xyz"])
    );
  });

  test("handles invoice.payment_succeeded and renews subscription", async () => {
    stripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "invoice.payment_succeeded",
      data: { object: { subscription: "sub_xyz" } },
    });
    stripe.subscriptions.retrieve.mockResolvedValueOnce({
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
    });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/billing/webhook")
      .set("stripe-signature", "t=123,v1=abc")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("subscription_status = 'active'"),
      expect.any(Array)
    );
  });

  test("handles invoice.payment_failed and marks past_due", async () => {
    stripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_abc" } },
    });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/billing/webhook")
      .set("stripe-signature", "t=123,v1=abc")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("past_due"),
      expect.any(Array)
    );
  });

  test("handles customer.subscription.deleted and marks inactive", async () => {
    stripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_xyz" } },
    });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/billing/webhook")
      .set("stripe-signature", "t=123,v1=abc")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("inactive"),
      expect.any(Array)
    );
  });

  test("ignores unknown event types and returns received:true", async () => {
    stripe.webhooks.constructEvent.mockReturnValueOnce({
      type: "customer.created",
      data: { object: {} },
    });
    const res = await request(app)
      .post("/billing/webhook")
      .set("stripe-signature", "t=123,v1=abc")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
