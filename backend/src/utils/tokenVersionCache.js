import logger from "./logger.js";

const TTL_SECONDS = 30;

// Use Redis if REDIS_URL is configured, otherwise fall back to in-process Map
let redisClient = null;

// Wrapped in async IIFE to avoid top-level await (Jest/CJS compat)
(async () => {
  if (!process.env.REDIS_URL) {
    logger.info("Token version cache: using in-memory (set REDIS_URL for multi-instance support)");
    return;
  }
  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(process.env.REDIS_URL, { lazyConnect: true });
    await redisClient.connect();
    logger.info("Token version cache: using Redis");
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — falling back to in-memory cache");
    redisClient = null;
  }
})();

// In-memory fallback
const memCache = new Map();

function memGet(userId) {
  const entry = memCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) return entry.version;
  return null;
}

function memSet(userId, version) {
  memCache.set(userId, { version, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

function memDel(userId) {
  memCache.delete(userId);
}

const CACHE_KEY = (userId) => `tv:${userId}`;

export async function getCachedTokenVersion(userId) {
  if (redisClient) {
    const val = await redisClient.get(CACHE_KEY(userId));
    return val === null ? null : Number(val);
  }
  return memGet(userId);
}

export async function setCachedTokenVersion(userId, version) {
  if (redisClient) {
    await redisClient.setex(CACHE_KEY(userId), TTL_SECONDS, version);
    return;
  }
  memSet(userId, version);
}

export async function invalidateTokenVersionCache(userId) {
  if (redisClient) {
    await redisClient.del(CACHE_KEY(userId));
    return;
  }
  memDel(userId);
}
