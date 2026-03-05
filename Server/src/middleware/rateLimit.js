const store = new Map();

function createRateLimiter({ windowMs, maxRequests, keyFn }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip;
    const bucket = store.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    store.set(key, bucket);

    if (bucket.count > maxRequests) {
      return res.status(429).json({ msg: "Too many requests. Please try again later." });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
