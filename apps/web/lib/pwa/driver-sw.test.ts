// Loads the real public/driver-sw.js in a sandbox and checks its pure helpers.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type Sw = {
  routeFor: (method: string, url: string, mode: string, origin: string, isRsc?: boolean) => string;
  safeNotificationUrl: (raw: unknown, origin: string) => string;
  buildNotification: (payload: unknown, origin: string) => { title: string; options: Record<string, unknown> };
  extractStaticAssets: (html: string) => string[];
  CACHE_PREFIX: string;
  SHELL_CACHE: string;
  STATIC_CACHE: string;
};

const source = fs.readFileSync(path.resolve(__dirname, '../../public/driver-sw.js'), 'utf8');
const listeners: Record<string, unknown> = {};
const sandbox: Record<string, unknown> = {
  URL,
  self: { addEventListener: (type: string, fn: unknown) => (listeners[type] = fn), location: { origin: 'https://www.epyccs.com' } },
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const sw = sandbox as unknown as Sw;
const O = 'https://www.epyccs.com';

describe('driver-sw.js wiring', () => {
  it('registers install, activate, fetch, push, notificationclick', () => {
    expect(Object.keys(listeners).sort()).toEqual(['activate', 'fetch', 'install', 'notificationclick', 'push']);
  });
  it('versions its caches under one prefix', () => {
    expect(sw.SHELL_CACHE.startsWith(sw.CACHE_PREFIX)).toBe(true);
    expect(sw.STATIC_CACHE.startsWith(sw.CACHE_PREFIX)).toBe(true);
    expect(sw.SHELL_CACHE).not.toBe(sw.STATIC_CACHE);
  });
});

describe('routeFor (what may be cached)', () => {
  it('never touches non-GET requests', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(sw.routeFor(m, `${O}/driver/jobs`, 'navigate', O)).toBe('bypass');
      expect(sw.routeFor(m, `${O}/_next/static/chunks/a.js`, 'no-cors', O)).toBe('bypass');
    }
  });
  it('never touches API, auth, or monitoring routes', () => {
    expect(sw.routeFor('GET', `${O}/api/driver/offers`, 'cors', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/api/driver/offers`, 'navigate', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/auth/callback?code=x`, 'navigate', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/monitoring?o=1`, 'cors', O)).toBe('bypass');
  });
  it('never touches cross-origin requests (Supabase, Maps)', () => {
    expect(sw.routeFor('GET', 'https://abc.supabase.co/rest/v1/drivers', 'cors', O)).toBe('bypass');
    expect(sw.routeFor('GET', 'https://abc.supabase.co/_next/static/x.js', 'cors', O)).toBe('bypass');
    expect(sw.routeFor('GET', 'https://maps.googleapis.com/maps/api/js', 'no-cors', O)).toBe('bypass');
  });
  it('never touches Next.js RSC data requests (they carry user data)', () => {
    expect(sw.routeFor('GET', `${O}/driver/jobs?_rsc=abc`, 'cors', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/driver/jobs`, 'cors', O, true)).toBe('bypass');
  });
  it('handles driver navigations network-first, others not at all', () => {
    expect(sw.routeFor('GET', `${O}/driver/jobs`, 'navigate', O)).toBe('navigate');
    expect(sw.routeFor('GET', `${O}/driver/delivery/123`, 'navigate', O)).toBe('navigate');
    expect(sw.routeFor('GET', `${O}/`, 'navigate', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/client/deliveries`, 'navigate', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/driverx`, 'navigate', O)).toBe('bypass');
  });
  it('caches static assets and icons cache-first', () => {
    expect(sw.routeFor('GET', `${O}/_next/static/chunks/main-abc.js`, 'no-cors', O)).toBe('cache-first');
    expect(sw.routeFor('GET', `${O}/_next/static/css/a.css`, 'no-cors', O)).toBe('cache-first');
    expect(sw.routeFor('GET', `${O}/icons/driver-192.png`, 'no-cors', O)).toBe('cache-first');
  });
  it('passes everything else through', () => {
    expect(sw.routeFor('GET', `${O}/images/logo.png`, 'no-cors', O)).toBe('bypass');
    expect(sw.routeFor('GET', `${O}/driver.webmanifest`, 'cors', O)).toBe('bypass');
    expect(sw.routeFor('GET', 'not a url', 'cors', O)).toBe('bypass');
  });
});

describe('safeNotificationUrl', () => {
  it('allows same-origin /driver/ paths', () => {
    expect(sw.safeNotificationUrl('/driver/delivery/9?x=1', O)).toBe('/driver/delivery/9?x=1');
    expect(sw.safeNotificationUrl(`${O}/driver/jobs`, O)).toBe('/driver/jobs');
  });
  it('falls back to /driver/jobs for anything else', () => {
    expect(sw.safeNotificationUrl('https://evil.example/driver/jobs', O)).toBe('/driver/jobs');
    expect(sw.safeNotificationUrl('/client/deliveries', O)).toBe('/driver/jobs');
    expect(sw.safeNotificationUrl('javascript:alert(1)', O)).toBe('/driver/jobs');
    expect(sw.safeNotificationUrl('//evil.example/driver/', O)).toBe('/driver/jobs');
    expect(sw.safeNotificationUrl(undefined, O)).toBe('/driver/jobs');
    expect(sw.safeNotificationUrl('', O)).toBe('/driver/jobs');
  });
});

describe('buildNotification', () => {
  it('uses the payload title, body, and a safe url', () => {
    const n = sw.buildNotification({ title: 'New job', body: 'Downey to Irvine', url: '/driver/jobs', tag: 'offer-1' }, O);
    expect(n.title).toBe('New job');
    expect(n.options.body).toBe('Downey to Irvine');
    expect(n.options.data).toEqual({ url: '/driver/jobs' });
    expect(n.options.tag).toBe('offer-1');
  });
  it('defaults safely on empty or junk payloads', () => {
    const n = sw.buildNotification(null, O);
    expect(n.title).toBe('EPYC Driver');
    expect(n.options.data).toEqual({ url: '/driver/jobs' });
    expect(sw.buildNotification({ url: 'https://evil.example' }, O).options.data).toEqual({ url: '/driver/jobs' });
  });
});

describe('extractStaticAssets', () => {
  it('finds unique /_next/static src and href values only', () => {
    const html =
      '<link rel="stylesheet" href="/_next/static/css/a.css"/><script src="/_next/static/chunks/b.js"></script>' +
      '<script src="/_next/static/chunks/b.js"></script><img src="/images/logo.png"/><a href="/driver/jobs">x</a>';
    expect(sw.extractStaticAssets(html).sort()).toEqual(['/_next/static/chunks/b.js', '/_next/static/css/a.css']);
  });
});
