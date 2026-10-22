const rateLimit = require("express-rate-limit");

// Draft-7 standard headers include RateLimit and RateLimit-Policy.
// Keep automated Jest tests isolated from low production quotas.
const isTest = process.env.NODE_ENV === "test";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "พยายามเข้าสู่ระบบเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง",
    },
  },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isTest ? 1000 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "คำขอเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง",
    },
  },
});

// Preserve the existing Week 4 requirement: POST /students allows 5 requests/minute.
// Explicit headers make the quota visible in Postman as well.
const studentStore = new Map();
function simpleRateLimit(req, res, next) {
  const windowMs = 60 * 1000;
  const max = 5;
  const key = req.ip;
  const now = Date.now();
  let entry = studentStore.get(key);
  if (!entry || now - entry.start >= windowMs) {
    entry = { count: 0, start: now };
  }
  entry.count += 1;
  studentStore.set(key, entry);

  const remaining = Math.max(0, max - entry.count);
  const resetSeconds = Math.max(0, Math.ceil((entry.start + windowMs - now) / 1000));
  res.setHeader("RateLimit-Limit", String(max));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(resetSeconds));
  res.setHeader("RateLimit-Policy", `${max};w=60`);

  if (entry.count > max) {
    return res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "คำขอเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง",
      },
    });
  }
  next();
}

module.exports = { authLimiter, generalLimiter, simpleRateLimit };
