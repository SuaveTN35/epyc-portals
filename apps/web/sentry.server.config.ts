import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Only enable in production or when DSN is set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set environment
  environment: process.env.NODE_ENV,

  // Add EPYC context to all events
  initialScope: {
    tags: {
      app: 'epyc-web',
      runtime: 'server',
      region: 'socal',
    },
  },

  // Filter out noisy errors
  ignoreErrors: [
    // Expected errors
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error'],
    }),
  ],

  beforeSend(event) {
    // Don't send events in development unless explicitly testing
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
      console.log('[Sentry Server] Event captured (dev mode, not sent):', event.message || event.exception);
      return null;
    }
    return event;
  },
});
