import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from './rate-limit';

describe('Rate Limiter', () => {
  describe('checkRateLimit', () => {
    it('should allow requests under the limit', () => {
      const identifier = `test-${Date.now()}`;
      const result = checkRateLimit(identifier, { limit: 10, windowSeconds: 60 });

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.limit).toBe(10);
    });

    it('should block requests over the limit', () => {
      const identifier = `test-block-${Date.now()}`;
      const config = { limit: 3, windowSeconds: 60 };

      // Make 3 requests (should all succeed)
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);

      // 4th request should fail
      const result = checkRateLimit(identifier, config);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track remaining requests correctly', () => {
      const identifier = `test-remaining-${Date.now()}`;
      const config = { limit: 5, windowSeconds: 60 };

      const r1 = checkRateLimit(identifier, config);
      expect(r1.remaining).toBe(4);

      const r2 = checkRateLimit(identifier, config);
      expect(r2.remaining).toBe(3);

      const r3 = checkRateLimit(identifier, config);
      expect(r3.remaining).toBe(2);
    });

    it('should return a reset timestamp', () => {
      const identifier = `test-reset-${Date.now()}`;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const result = checkRateLimit(identifier, { limit: 10, windowSeconds: 60 });

      // Allow 1 second buffer for timing
      expect(result.reset).toBeGreaterThanOrEqual(nowSeconds);
      expect(result.reset).toBeLessThanOrEqual(nowSeconds + 61);
    });
  });

  describe('getClientIdentifier', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.2');
    });

    it('should fall back to user-agent when no IP headers', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toMatch(/^ua:/);
    });
  });

  describe('RATE_LIMITS config', () => {
    it('should have broker API limits', () => {
      expect(RATE_LIMITS.brokerApi).toEqual({
        limit: 100,
        windowSeconds: 60,
      });
    });

    it('should have auth limits', () => {
      expect(RATE_LIMITS.auth).toEqual({
        limit: 10,
        windowSeconds: 60,
      });
    });

    it('should have general API limits', () => {
      expect(RATE_LIMITS.api).toEqual({
        limit: 60,
        windowSeconds: 60,
      });
    });
  });
});
