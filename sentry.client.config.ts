import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production
  tracesSampleRate: 1.0,
  
  // Capture replay in production
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // Setting this option to true will print useful info to the console
  debug: false,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});