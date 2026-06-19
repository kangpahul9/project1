import "dotenv/config";

// ── Startup env validation ─────────────────────────────────────────────────
{
  const required = ["JWT_SECRET"];
  if (process.env.NODE_ENV === "production") {
    required.push("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME");
  }
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[startup] Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
  if ((process.env.JWT_SECRET || "").length < 32) {
    console.error("[startup] JWT_SECRET must be at least 32 characters");
    process.exit(1);
  }
}

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import jwt from "jsonwebtoken";

import pool from "./config/db.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import timeout from "connect-timeout";
import pinoHttp from "pino-http";
import logger from "./utils/logger.js";
import { randomUUID } from "crypto";



// routes
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import menuRoutes from "./routes/menu.js";
import businessDayRoutes from "./routes/businessDays.js";
import ordersRoutes from "./routes/orders.js";
import cashRoutes from "./routes/cash.js";
import reportsRoutes from "./routes/reports.js";
import withdrawalsRouter from "./routes/withdrawals.js";
import expensesRoutes from "./routes/expenses.js";
import vendorsRoutes from "./routes/vendors.js";
import staffRoutes from "./routes/staff.js";
import menuCategoriesRoutes from "./routes/menuCategories.js";
import restaurantRoutes from "./routes/restaurant.js";
import settingsRoutes from "./routes/settings.js";
import partnersRoutes from "./routes/partners.js";
import bankRoutes from "./routes/bank.js";
// import billingRoutes from "./routes/billing.js"; // Stripe disabled
import rosterRoutes from "./routes/roster.js";
import payrollRoutes from "./routes/payroll.js";
import xeroRoutes from "./routes/xero.js";
import eftposRoutes from "./routes/eftpos.js";
import combosRoutes from "./routes/combos.js";

// middleware
import { authenticate } from "./middleware/authMiddleware.js";
import { loadSettings } from "./middleware/loadSettings.js";
import { attachBusinessDay } from "./middleware/attachBusinessDay.js";
import { checkSubscription } from "./middleware/checkSubscription.js";

// jobs
import { generateMonthlySalary } from "./jobs/salaryGenerator.js";
import { autoClockOut } from "./jobs/autoClockOut.js";



const app = express();
app.set("trust proxy", 1);

const apiRouter = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const smartKeyGenerator = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
  const token = authHeader.split(" ")[1];
  const parts = token.split(".");
  if (parts.length !== 3) return ipKeyGenerator(req);

  const decoded = JSON.parse(
    Buffer.from(parts[1], "base64url").toString()
  );

  return `user_${decoded.id}`;
} catch {
  return req.ip;
}
  }

  return req.ip;
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: smartKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    message: "Too many login attempts. Try again later.",
  },
});

/* =========================
   GLOBAL MIDDLEWARE
========================= */
app.use(
  pinoHttp({
    logger,
    customReceivedMessage: (req) => `→ ${req.method} ${req.url}`,
    customSuccessMessage:  (req, res) => `← ${res.statusCode} ${req.method} ${req.url}`,
    customErrorMessage:    (req, res, err) => `✗ ${res.statusCode} ${req.method} ${req.url} — ${err.message}`,
  })
);

app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);

  req.log = req.log.child({ requestId: req.id });

  next();
});

// request logger (VERY useful in prod)
app.use((req, res, next) => {
  if (req.userId) {
    req.log = req.log.child({
      userId: req.userId,
      restaurantId: req.restaurantId,
    });
  }
  next();
});

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((u) => u.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
  })
);
app.use(timeout("10s"));

// send timeout response immediately when timed out
app.use((req, res, next) => {
  if (req.timedout) {
    if (!res.headersSent) {
      return res.status(503).json({
        message: "Request timeout",
      });
    }
    return;
  }
  next();
});

// prevent further processing after timeout
function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}

app.use(haltOnTimedout);

// app.use("/api/billing/webhook", express.raw({ type: "application/json" })); // Stripe disabled


app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    limit: "1mb",
    extended: true,
  })
);


// serve uploads — JWT required (Authorization header or ?token= query param)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
app.get("/uploads/:filename", (req, res) => {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) ||
    req.query.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    const filename = path.basename(req.params.filename);
    res.sendFile(path.join(UPLOAD_DIR, filename));
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ status: "db_down" });
  }
});

app.use("/api", globalLimiter, apiRouter);

apiRouter.use("/auth", authLimiter, authRoutes);

// Xero OAuth callback must be before authenticate — Xero redirects here with no JWT
apiRouter.use("/xero", xeroRoutes);

/* =========================
   PROTECTED MIDDLEWARE STACK
========================= */
apiRouter.use(authenticate);
// apiRouter.use(checkSubscription);   // DISABLED TEMPORARILY
apiRouter.use(loadSettings);
apiRouter.use(attachBusinessDay);


/* =========================
   ROUTES
========================= */
// apiRouter.use("/billing", billingRoutes); // Stripe disabled
apiRouter.use("/settings", settingsRoutes);

apiRouter.use("/menu", menuRoutes);
apiRouter.use("/ai", aiRoutes);
apiRouter.use("/business-days", businessDayRoutes);
apiRouter.use("/orders", ordersRoutes);
apiRouter.use("/orders/cash", cashRoutes);
apiRouter.use("/reports", reportsRoutes);
apiRouter.use("/withdrawals", withdrawalsRouter);
apiRouter.use("/expenses", expensesRoutes);
apiRouter.use("/vendors", vendorsRoutes);
apiRouter.use("/staff", staffRoutes);
apiRouter.use("/roster", rosterRoutes);
apiRouter.use("/payroll", payrollRoutes);
apiRouter.use("/eftpos", eftposRoutes);
apiRouter.use("/combos", combosRoutes);
apiRouter.use("/menu/categories", menuCategoriesRoutes);
apiRouter.use("/restaurant", restaurantRoutes);
apiRouter.use("/partners", partnersRoutes);
apiRouter.use("/bank", bankRoutes);



/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
logger.error({ err }, "Unhandled error");

if (err.timeout) {
  return res.status(503).json({
    message: "Request timeout",
  });
}

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      message: "Payload too large",
    });
  }

  if (err.message === "Invalid JSON") {
    return res.status(400).json({
      message: "Invalid JSON format",
    });
  }

  // PostgreSQL errors have a 5-char code (e.g. "23502"). Plain business errors don't.
  const isDbError = err.code && /^[0-9A-Z]{5}$/.test(err.code);

  res.status(isDbError ? 500 : 400).json({
    message: isDbError
      ? "A database error occurred"
      : (err.message || "Internal server error"),
  });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

/* =========================
   CRON JOBS (OUTSIDE LISTEN)
========================= */
cron.schedule(
  "0 1 * * *",
  async () => {
    try {
      logger.info("Running monthly salary generator...");
      await generateMonthlySalary();
    } catch (err) {
      logger.error({ err }, "Salary generator failed");
    }
  },
  { timezone: "Asia/Kolkata" }
);

// Auto clock-out: every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  try {
    await autoClockOut();
  } catch (err) {
    logger.error({ err }, "Auto clock-out job failed");
  }
});
