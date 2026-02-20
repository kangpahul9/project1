import dotenv from "dotenv";
dotenv.config();
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



const app = express();

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "Backend running 🚀" });
});

const PORT = process.env.PORT || 3000;

pool.connect()
  .then(() => console.log("PostgreSQL connected ✅"))
  .catch(err => console.error("DB connection failed ❌", err));

app.use("/auth", authRoutes);

app.get("/protected", authenticate, (req, res) => {
  res.json({ message: "You are authenticated", user: req.user });
});

app.use("/menu", menuRoutes);

app.use("/business-days", businessDayRoutes);

app.use("/orders", ordersRoutes);

app.use("/orders/cash", cashRoutes);

app.use("/reports", reportsRoutes);

app.use("/withdrawals", withdrawalsRouter);



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
