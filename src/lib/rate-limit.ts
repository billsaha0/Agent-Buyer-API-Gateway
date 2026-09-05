type RateLimitRecord = {
  count: number;
  resetTime: number;
};

// Use the global object to persist the Map across Next.js HMR (Hot Module Replacement)
const globalForRateLimit = global as unknown as { 
  rateLimitStore: Map<string, RateLimitRecord> 
};
const store = globalForRateLimit.rateLimitStore || new Map<string, RateLimitRecord>();
if (process.env.NODE_ENV !== "production") globalForRateLimit.rateLimitStore = store;

export function checkRateLimit(
  tokenHash: string, 
  limit: number = 15,
  windowMs: number = 60000
) {
  const now = Date.now();
  const record = store.get(tokenHash);

  if (!record || now > record.resetTime) {
    store.set(tokenHash, { count: 1, resetTime: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, limit, remaining: 0, reset: record.resetTime };
  }

  record.count += 1;
  return { success: true, limit, remaining: limit - record.count, reset: record.resetTime };
}