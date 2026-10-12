import * as Sentry from '@sentry/react';

let isSentryActive = false;

export function initObservability() {
  // Check if running on localhost, 127.0.0.1, dev mode, or test environment
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local') ||
      window.location.port !== '');

  const isDev = import.meta.env.DEV || isLocalhost;

  if (isDev) {
    console.info(
      '[Observability] 🛡️ Ambiente local detectado: envio ao Sentry DESATIVADO para preservar sua cota de dados.'
    );
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (dsn && dsn.trim().length > 0) {
    try {
      Sentry.init({
        dsn,
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
        // Sample errors in production
        tracesSampleRate: 0.1, // Sample 10% of performance transactions to conserve data
        environment: 'production',
      });
      isSentryActive = true;
      console.info('[Observability] Sentry inicializado com sucesso para produção.');
    } catch (err) {
      console.warn('[Observability] Falha ao inicializar Sentry:', err);
    }
  } else {
    console.info('[Observability] Sentry DSN não configurado. Rodando em modo de observabilidade local.');
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
