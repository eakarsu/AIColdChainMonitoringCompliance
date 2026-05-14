// Rate limiter: 20 AI calls per hour per user
// Uses a simple in-memory store (suitable for single-instance deployments).

const store = new Map(); // key: userId, value: { count, resetAt }

const MAX_CALLS = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export default function aiRateLimiter(req, res, next) {
  const userId = req.user?.id || req.ip;
  const now = Date.now();

  let record = store.get(userId);

  if (!record || now >= record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    store.set(userId, record);
  }

  if (record.count >= MAX_CALLS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', MAX_CALLS);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', new Date(record.resetAt).toISOString());
    return res.status(429).json({
      error: 'AI rate limit exceeded',
      message: `Maximum ${MAX_CALLS} AI calls per hour. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      retryAfterSeconds: retryAfter,
    });
  }

  record.count += 1;
  res.setHeader('X-RateLimit-Limit', MAX_CALLS);
  res.setHeader('X-RateLimit-Remaining', MAX_CALLS - record.count);
  res.setHeader('X-RateLimit-Reset', new Date(record.resetAt).toISOString());

  next();
}
