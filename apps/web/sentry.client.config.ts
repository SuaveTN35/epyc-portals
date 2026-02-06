import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay - capture 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production or when DSN is set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set environment
  environment: process.env.NODE_ENV,

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    // Network errors users cause by navigating away
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User cancelled
    'AbortError',
    'The operation was aborted',
  ],

  // Add EPYC context to all events
  initialScope: {
    tags: {
      app: 'epyc-web',
      region: 'socal',
    },
  },

  // Before sending, add user context if available
  beforeSend(event) {
    // Don't send events in development unless explicitly testing
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      console.log('[Sentry] Event captured (dev mode, not sent):', event.message || event.exception);
      return null;
    }
    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content by default for privacy
      maskAllText: false,
      // Block all media by default
      blockAllMedia: false,
    }),
  ],
});
