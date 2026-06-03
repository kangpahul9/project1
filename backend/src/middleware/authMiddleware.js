import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";

export const authenticate = (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized: No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.userId = decoded.id;
    req.restaurantId = decoded.restaurantId;

    next();
  } catch (err) {
    logger.warn({ err: err.message }, "Auth token invalid");

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Forbidden: Admin access required",
    });
  }
  next();
};