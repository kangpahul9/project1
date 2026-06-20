import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import authRouter from "../../src/routes/auth.js";

jest.mock("../../src/services/userService.js");
jest.mock("../../src/config/db.js", () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue({ rows: [{ token_version: 0 }], rowCount: 1 }), connect: jest.fn() },
}));

const { findUserByEmail } = require("../../src/services/userService.js");

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

const VALID_HASH = bcrypt.hashSync("password123", 10);

const mockUser = {
  id: 1,
  name: "Test Admin",
  role: "ADMIN",
  restaurant_id: 42,
  password_hash: VALID_HASH,
  is_active: true,
};

describe("POST /auth/login", () => {
  test("returns JWT token on valid credentials", async () => {
    findUserByEmail.mockResolvedValue(mockUser);

    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "admin@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.role).toBe("ADMIN");
    expect(res.body.userId).toBe(1);

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.restaurantId).toBe(42);
    expect(decoded.role).toBe("ADMIN");
  });

  test("returns 401 for wrong password", async () => {
    findUserByEmail.mockResolvedValue(mockUser);

    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "admin@test.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
    expect(res.body).not.toHaveProperty("token");
  });

  test("returns 401 for non-existent user", async () => {
    findUserByEmail.mockResolvedValue(null);

    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "nobody@test.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  test("returns 400 when email is missing", async () => {
    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid input");
  });

  test("returns 400 when password is missing", async () => {
    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "admin@test.com",
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 when restaurantUid is missing", async () => {
    const res = await request(app).post("/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    expect(res.status).toBe(400);
  });

  test("returns 403 for disabled account", async () => {
    findUserByEmail.mockResolvedValue({ ...mockUser, is_active: false });

    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "admin@test.com",
      password: "password123",
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("disabled");
  });

  test("normalizes email to lowercase", async () => {
    findUserByEmail.mockResolvedValue(mockUser);

    await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "ADMIN@TEST.COM",
      password: "password123",
    });

    expect(findUserByEmail).toHaveBeenCalledWith("test-uid", "admin@test.com");
  });

  test("JWT token expires in 8h", async () => {
    findUserByEmail.mockResolvedValue(mockUser);

    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "admin@test.com",
      password: "password123",
    });

    const decoded = jwt.decode(res.body.token);
    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(8 * 60 * 60);
  });

  test("rejects non-string password (array injection)", async () => {
    const res = await request(app).post("/auth/login").send({
      restaurantUid: "test-uid",
      email: "admin@test.com",
      password: ["hack"],
    });

    expect(res.status).toBe(400);
  });
});
