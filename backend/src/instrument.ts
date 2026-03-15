/**
 * Sentry instrumentation — must be the first module imported in index.ts.
 * Set SENTRY_DSN in the environment to enable; omit or leave blank to disable.
 */
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // Capture 10 % of transactions in production; 100 % otherwise
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Unhandled promise rejections are captured automatically by the Node SDK
});
