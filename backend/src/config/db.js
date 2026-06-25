import dotenv from "dotenv";
dotenv.config();

import pkg from "pg";
import logger from "../utils/logger.js";
const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // In production require SSL (RDS default). Set DB_SSL=false to override.
  ssl: isProduction
    ? process.env.DB_SSL === "false"
      ? false
      : { rejectUnauthorized: process.env.DB_SSL_NO_VERIFY !== "true" }
    : false,

  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

if (!isProduction) {
  pool.on("connect", () => logger.info("PostgreSQL connected"));
}

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected DB pool error");
});

process.on("SIGINT", async () => {
  logger.info("SIGINT — closing DB pool");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM — closing DB pool");
  await pool.end();
  process.exit(0);
});

export default pool;
