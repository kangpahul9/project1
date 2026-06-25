import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import {
  getCachedTokenVersion,
  setCachedTokenVersion,
  invalidateTokenVersionCache,
} from "../utils/tokenVersionCache.js";

export { invalidateTokenVersionCache as invalidateVersionCache };

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenVersion = decoded.tokenVersion ?? 0;
    let dbVersion = await getCachedTokenVersion(decoded.id);

    if (dbVersion === null) {
      const result = await pool.query(
        "SELECT token_version FROM users WHERE id=$1",
        [decoded.id]
      );
      if (!result.rows.length) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      dbVersion = result.rows[0].token_version;
      await setCachedTokenVersion(decoded.id, dbVersion);
    }

    if (tokenVersion !== dbVersion) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = decoded;
    req.userId = decoded.id;
    req.restaurantId = decoded.restaurantId;

    next();
  } catch (err) {
    logger.warn({ err: err.message }, "Auth token invalid");
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
};
