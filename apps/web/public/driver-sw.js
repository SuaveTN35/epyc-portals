/* EPYC Driver service worker. Registered only from /driver pages with scope '/driver/'.
 *
 * Caching rules (auth safety first):
 *   - Navigations inside /driver/: network only. If the network fails, show the
 *     precached /driver/offline page. Signed-in HTML is NEVER stored.
 *   - /_next/static/* and /icons/*: cache first (content-hashed or static files).
 *   - Everything else passes straight to the network untouched: any non-GET,
 *     /api/*, /auth/*, Next.js RSC data requests, and every cross-origin request
 *     (Supabase, Google Maps, Stripe, Sentry).
 *
 * Bump CACHE_VERSION to force every phone to drop old caches on next activate.
 */
'use strict';

var CACHE_PREFIX = 'epyc-driver-';
var CACHE_VERSION = 'v1';
var SHELL_CACHE = CACHE_PREFIX + CACHE_VERSION + '-shell';
var STATIC_CACHE = CACHE_PREFIX + CACHE_VERSION + '-static';
var OFFLINE_URL = '/driver/offline';
var DEFAULT_OPEN_URL = '/driver/jobs';
var STATIC_CACHE_MAX_ENTRIES = 200;
var PRECACHE_ICONS = [
  '/icons/driver-192.png',
  '/icons/driver-512.png',
  '/icons/driver-maskable-512.png',
  '/icons/driver-apple-touch-icon.png',
];

/**
 * Decide how a request is handled. Pure: no side effects.
 * Returns 'navigate' | 'cache-first' | 'bypass'.
 */
function routeFor(method, urlString, mode, origin, isRscRequest) {
  if (method !== 'GET') return 'bypass';
  var url;
  try {
    url = new URL(urlString);
  } catch (e) {
    return 'bypass';
  }
  if (url.origin !== origin) return 'bypass';
  var path = url.pathname;
  if (path.indexOf('/api/') === 0 || path === '/api') return 'bypass';
  if (path.indexOf('/auth/') === 0 || path === '/auth') return 'bypass';
  if (path.indexOf('/monitoring') === 0) return 'bypass';
  if (isRscRequest || url.searchParams.has('_rsc')) return 'bypass';
  if (mode === 'navigate') {
    return path === '/driver' || path.indexOf('/driver/') === 0 ? 'navigate' : 'bypass';
  }
  if (path.indexOf('/_next/static/') === 0 || path.indexOf('/icons/') === 0) return 'cache-first';
  return 'bypass';
}

/** Only same-origin /driver/ URLs may be opened from a notification. */
function safeNotificationUrl(raw, origin) {
  if (typeof raw !== 'string' || raw === '') return DEFAULT_OPEN_URL;
  var url;
  try {
    url = new URL(raw, origin);
  } catch (e) {
    return DEFAULT_OPEN_URL;
  }
  if (url.origin !== origin) return DEFAULT_OPEN_URL;
  if (url.pathname !== '/driver' && url.pathname.indexOf('/driver/') !== 0) return DEFAULT_OPEN_URL;
  return url.pathname + url.search + url.hash;
}

/** Build showNotification() arguments from a push payload. Pure. */
function buildNotification(payload, origin) {
  var p = payload && typeof payload === 'object' ? payload : {};
  var title = typeof p.title === 'string' && p.title.trim() ? p.title.trim() : 'EPYC Driver';
  var options = {
    body: typeof p.body === 'string' ? p.body : 'You have a new update.',
    icon: '/icons/driver-192.png',
    badge: '/icons/driver-192.png',
    data: { url: safeNotificationUrl(p.url, origin) },
  };
  if (typeof p.tag === 'string' && p.tag) {
    options.tag = p.tag;
    options.renotify = true;
  }
  return { title: title, options: options };
}

/** Pull /_next/static asset URLs out of the offline page HTML so it renders styled offline. */
function extractStaticAssets(html) {
  var found = {};
  var re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    found[m[1].replace(/&amp;/g, '&')] = true;
  }
  return Object.keys(found);
}

function isCacheable(response) {
  return !!response && response.status === 200 && response.type === 'basic';
}

function trimCache(cacheName, maxEntries) {
  return caches.open(cacheName).then(function (cache) {
    return cache.keys().then(function (keys) {
      if (keys.length <= maxEntries) return undefined;
      var extra = keys.slice(0, keys.length - maxEntries);
      return Promise.all(extra.map(function (k) { return cache.delete(k); }));
    });
  });
}

function precache() {
  return caches.open(SHELL_CACHE).then(function (shell) {
    // The offline page is static (no user data). Required: if it cannot be
    // fetched, install fails and the browser retries on a later visit.
    return fetch(OFFLINE_URL, { cache: 'reload', credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('offline page fetch failed: ' + res.status);
      return res
        .clone()
        .text()
        .then(function (html) {
          return shell.put(OFFLINE_URL, res).then(function () {
            return caches.open(STATIC_CACHE).then(function (staticCache) {
              var urls = extractStaticAssets(html).concat(PRECACHE_ICONS);
              return Promise.all(
                urls.map(function (u) {
                  return staticCache.add(u).catch(function () { return undefined; });
                })
              );
            });
          });
        });
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (res) {
      if (isCacheable(res)) {
        var copy = res.clone();
        caches
          .open(STATIC_CACHE)
          .then(function (c) { return c.put(request, copy); })
          .then(function () { return trimCache(STATIC_CACHE, STATIC_CACHE_MAX_ENTRIES); })
          .catch(function () { return undefined; });
      }
      return res;
    });
  });
}

function networkWithOfflineFallback(request) {
  // Never stored: the response may contain a signed-in driver's data.
  return fetch(request).catch(function () {
    return caches.match(OFFLINE_URL).then(function (offline) {
      return offline || new Response("You're offline. Reconnect and refresh.", {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    });
  });
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', function (event) {
    event.waitUntil(precache().then(function () { return self.skipWaiting(); }));
  });

  self.addEventListener('activate', function (event) {
    var keep = [SHELL_CACHE, STATIC_CACHE];
    event.waitUntil(
      caches
        .keys()
        .then(function (names) {
          return Promise.all(
            names
              .filter(function (n) { return n.indexOf(CACHE_PREFIX) === 0 && keep.indexOf(n) === -1; })
              .map(function (n) { return caches.delete(n); })
          );
        })
        .then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.headers.has('range')) return;
    var route = routeFor(req.method, req.url, req.mode, self.location.origin, req.headers.get('RSC') === '1');
    if (route === 'navigate') {
      event.respondWith(networkWithOfflineFallback(req));
    } else if (route === 'cache-first') {
      event.respondWith(cacheFirst(req));
    }
    // 'bypass': do not call respondWith; the browser handles it normally.
  });

  // Web push groundwork (Phase 3). Sending is Phase 3b.
  self.addEventListener('push', function (event) {
    var payload = {};
    if (event.data) {
      try {
        payload = event.data.json();
      } catch (e) {
        payload = { body: event.data.text() };
      }
    }
    var n = buildNotification(payload, self.location.origin);
    event.waitUntil(self.registration.showNotification(n.title, n.options));
  });

  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var data = event.notification.data || {};
    var target = safeNotificationUrl(data.url, self.location.origin);
    var absolute = new URL(target, self.location.origin).href;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (c.url.indexOf(self.location.origin + '/driver') === 0 && 'focus' in c) {
            return c.focus().then(function (focused) {
              if (focused && 'navigate' in focused) {
                return focused.navigate(absolute).catch(function () { return self.clients.openWindow(absolute); });
              }
              return self.clients.openWindow(absolute);
            });
          }
        }
        return self.clients.openWindow(absolute);
      })
    );
  });
}
