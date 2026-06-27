const AppError = require("../utils/AppError");

const stores = new Map();

const rateLimiter = ({ windowMs = 60 * 1000, max = 120, keyPrefix = "global" } = {}) => {
  const store = new Map();
  stores.set(keyPrefix, store);

  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      return next(new AppError("Too many requests, please try again later", 429, "Rate Limit Error"));
    }

    next();
  };
};

module.exports = rateLimiter;
