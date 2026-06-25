import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { authenticate, requireAdmin } from "../../src/middleware/authMiddleware.js";

const SECRET = process.env.JWT_SECRET;

const makeToken = (payload = {}) =>
  jwt.sign(
    { id: 1, restaurantId: 42, role: "ADMIN", ...payload },
    SECRET,
    { expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users" }
  );

const app = express();
app.use(express.json());

app.get("/protected", authenticate, (req, res) => {
  res.json({ userId: req.userId, restaurantId: req.restaurantId, role: req.user.role });
});

app.get("/admin-only", authenticate, requireAdmin, (req, res) => {
  res.json({ ok: true });
});

describe("authenticate middleware", () => {
  test("passes with valid Bearer token", async () => {
    const token = makeToken();
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(1);
    expect(res.body.restaurantId).toBe(42);
  });

  test("returns 401 with no token", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.message).toContain("No token");
  });

  test("returns 401 with malformed token", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer not.a.token");

    expect(res.status).toBe(401);
  });

  test("returns 401 with wrong secret", async () => {
    const badToken = jwt.sign({ id: 1 }, "wrong-secret");
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${badToken}`);

    expect(res.status).toBe(401);
  });

  test("returns 401 with expired token", async () => {
    const expired = jwt.sign(
      { id: 1, restaurantId: 42 },
      SECRET,
      { expiresIn: "-1s", issuer: "kangpos", audience: "kangpos-users" }
    );
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });

  test("does NOT accept token in query string", async () => {
    const token = makeToken();
    const res = await request(app).get(`/protected?token=${token}`);
    expect(res.status).toBe(401);
  });

  test("sets req.restaurantId from token", async () => {
    const token = makeToken({ restaurantId: 99 });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.restaurantId).toBe(99);
  });
});

describe("requireAdmin middleware", () => {
  test("passes for ADMIN role", async () => {
    const token = makeToken({ role: "ADMIN" });
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("returns 403 for STAFF role", async () => {
    const token = makeToken({ role: "STAFF" });
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Admin");
  });

  test("returns 401 before 403 if no token at all", async () => {
    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(401);
  });
});
