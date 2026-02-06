/**
 * Simple in-memory rate limiter for API routes
 * For production at scale, replace with Redis-based solution (Upstash, etc.)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = identifier;

  let entry = rateLimitStore.get(key);

  // Create new entry or reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, config.limit - entry.count);
  const success = entry.count <= config.limit;

  return {
    success,
    limit: config.limit,
    remaining,
    reset: Math.ceil(entry.resetTime / 1000),
  };
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }

  // Fallback to a hash of user-agent + some headers
  const ua = request.headers.get('user-agent') || 'unknown';
  return `ua:${ua.slice(0, 50)}`;
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Broker API: 100 requests per minute per API key
  brokerApi: { limit: 100, windowSeconds: 60 },

  // Auth endpoints: 10 requests per minute per IP
  auth: { limit: 10, windowSeconds: 60 },

  // General API: 60 requests per minute per IP
  api: { limit: 60, windowSeconds: 60 },

  // Quote requests: 20 per minute per IP
  quotes: { limit: 20, windowSeconds: 60 },

  // Stripe webhooks: 200 per minute (Stripe sends many)
  stripeWebhooks: { limit: 200, windowSeconds: 60 },
} as const;

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}
