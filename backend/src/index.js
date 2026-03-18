import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./config/db.js";
import authRoutes from "./routes/auth.js";
import { authenticate } from "./middleware/authMiddleware.js";
import menuRoutes from "./routes/menu.js";
import businessDayRoutes from "./routes/businessDays.js";
import ordersRoutes from "./routes/orders.js";
import cashRoutes from "./routes/cash.js";
import reportsRoutes from "./routes/reports.js";
import withdrawalsRouter from "./routes/withdrawals.js";
import expensesRoutes from "./routes/expenses.js";
import vendorsRoutes from "./routes/vendors.js";
import staffRoutes from "./routes/staff.js";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { generateMonthlySalary } from "./jobs/salaryGenerator.js";
import { sendWhatsAppTemplate } from "./services/whatsappService.js";
import menuCategoriesRoutes from "./routes/menuCategories.js";
import restaurantRoutes from "./routes/restaurant.js";
import settingsRoutes from "./routes/settings.js";
import { loadSettings } from "./middleware/loadSettings.js";
import {attachBusinessDay} from "./middleware/attachBusinessDay.js";
import partnersRoutes from "./routes/partners.js";
import bankRoutes from "./routes/bank.js";
import billingRoutes from "./routes/billing.js"
import { checkSubscription } from "./middleware/checkSubscription.js";





const app = express();
const apiRouter = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: true,   // reflect request origin automatically
    credentials: true,
  })
);



app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "Backend running 🚀" });
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));



const PORT = process.env.PORT || 3000;

pool.connect()
  .then(() => console.log("PostgreSQL connected ✅"))
  .catch(err => console.error("DB connection failed ❌", err));

apiRouter.use("/auth", authRoutes);

apiRouter.get("/protected", authenticate, (req, res) => {
  res.json({ message: "You are authenticated", user: req.user });
});

apiRouter.use(authenticate);
apiRouter.use(loadSettings);
apiRouter.use(attachBusinessDay);

apiRouter.use("/billing", billingRoutes);
apiRouter.use("/settings", settingsRoutes);

// apiRouter.use(checkSubscription);

// ALL PROTECTED ROUTES
apiRouter.use("/menu", menuRoutes);
apiRouter.use("/business-days", businessDayRoutes);
apiRouter.use("/orders", ordersRoutes);
apiRouter.use("/orders/cash", cashRoutes);
apiRouter.use("/reports", reportsRoutes);
apiRouter.use("/withdrawals", withdrawalsRouter);
apiRouter.use("/expenses", expensesRoutes);
apiRouter.use("/vendors", vendorsRoutes);
apiRouter.use("/staff", staffRoutes);
apiRouter.use("/menu/categories", menuCategoriesRoutes);
apiRouter.use("/restaurant", restaurantRoutes);
apiRouter.use("/partners", partnersRoutes);
apiRouter.use("/bank", bankRoutes);



// ATTACH TO /api
app.use("/api", apiRouter);

// app.get("/dev/run-salary", async (req, res) => {
//   try {
//     await generateMonthlySalary();
//     res.json({ message: "Salary generation executed" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Salary generator failed" });
//   }
// });

app.get("/dev/test-whatsapp", async (req, res) => {
  await sendWhatsAppTemplate("kangpos_test", ["KangPOS backend WhatsApp test 🚀"]);
  res.json({ message: "WhatsApp test sent" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
 cron.schedule(
  "0 1 * * *",
  async () => {
    try {
      console.log("Running monthly salary generator...");
      await generateMonthlySalary();
    } catch (err) {
      console.error("Salary generator failed:", err);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);
});
