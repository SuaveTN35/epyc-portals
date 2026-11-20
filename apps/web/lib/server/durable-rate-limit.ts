import { createHash } from 'crypto';
import { createAdminClient } from './supabase-admin';
import { checkRateLimit, type RateLimitConfig, type RateLimitResult } from '../rate-limit';

/**
 * Rate limit shared across every server instance, kept in Postgres
 * (public.rate_limit_hit, migration 20261119000000_durable_rate_limit.sql).
 *
 * The in-memory limiter still runs first, so a burst on one instance is cut
 * off without a database call. If the database is unreachable or the function
 * is missing, this falls back to the in-memory result instead of blocking
 * real customers.
 *
 * Keys are hashed before they leave the server; no raw IP is stored.
 */
export async function checkDurableRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const local = checkRateLimit(identifier, config);
  if (!local.success) return local;

  try {
    const admin = createAdminClient();
    if (!admin) return local;
    const key = createHash('sha256').update(identifier).digest('hex');
    // Fail open fast: a slow database must not hang the form.
    const { data, error } = await admin
      .rpc('rate_limit_hit', {
        p_key: key,
        p_limit: config.limit,
        p_window_seconds: config.windowSeconds,
      })
      .abortSignal(AbortSignal.timeout(1500));
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) {
      console.error('[durable-rate-limit] falling back to in-memory:', error?.message ?? 'no row');
      return local;
    }
    const hits = Number(row.hits);
    return {
      success: Boolean(row.allowed),
      limit: config.limit,
      remaining: Math.max(0, config.limit - hits),
      reset: Math.ceil(Date.parse(row.reset_at) / 1000),
    };
  } catch (e) {
    console.error('[durable-rate-limit] falling back to in-memory:', (e as Error).message);
    return local;
  }
}
