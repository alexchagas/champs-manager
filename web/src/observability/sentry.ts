import * as Sentry from '@sentry/react';

let isSentryActive = false;

export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (dsn && dsn.trim().length > 0) {
    try {
      Sentry.init({
        dsn,
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
        // Sample 100% of errors in closed beta
        tracesSampleRate: 1.0,
        // Environment tag
        environment: import.meta.env.MODE || 'production',
      });
      isSentryActive = true;
      console.info('[Observability] Sentry initialized successfully.');
    } catch (err) {
      console.warn('[Observability] Failed to initialize Sentry:', err);
    }
  } else {
    // Silent mode when DSN is not set yet
    console.info('[Observability] Sentry DSN not configured. Running in local observability mode.');
  }
}

export function captureError(error: unknown, context?: Record<string, any>) {
  console.error('[Observability Error]', error, context);
  if (isSentryActive) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error));
      }
    });
  }
}

export function addBreadcrumb(message: string, category = 'game', data?: Record<string, any>) {
  if (isSentryActive) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}
