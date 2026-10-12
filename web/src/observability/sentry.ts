import * as Sentry from '@sentry/react';

// Official Sentry DSN for alex-org-3b / javascript-react
const DEFAULT_DSN =
  'https://0fe88f0dba4b1ea02cc33e1dd7d2f1d6@o4512245219983361.ingest.de.sentry.io/4512245317763152';

let isSentryActive = false;

export function initObservability() {
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local') ||
      window.location.port !== '');

  const hasTestFlag =
    typeof window !== 'undefined' &&
    window.location.search.includes('test_sentry=1');

  const isDev = (import.meta.env.DEV || isLocalhost) && !hasTestFlag;

  // Strict guard: In local development, never send data to Sentry unless explicitly forced via ?test_sentry=1
  if (isDev) {
    console.info(
      '[Observability] 🛡️ Ambiente local detectado: Sentry desativado para economizar dados do plano gratuito.'
    );
    return;
  }

  const dsn =
    (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN;

  if (dsn && dsn.trim().length > 0) {
    try {
      Sentry.init({
        dsn: dsn.trim(),
        integrations: [Sentry.browserTracingIntegration()],
        // Sample 10% of performance transactions to conserve data
        tracesSampleRate: 0.1,
        environment: hasTestFlag ? 'test' : 'production',
      });
      isSentryActive = true;
      console.info('[Observability] Sentry inicializado com sucesso.');

      if (hasTestFlag) {
        Sentry.captureMessage('Champs Manager - Teste manual via URL ?test_sentry=1');
      }
    } catch (err) {
      console.warn('[Observability] Falha ao inicializar Sentry:', err);
    }
  } else {
    console.info('[Observability] Sentry DSN não configurado.');
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

export function addBreadcrumb(
  message: string,
  category = 'game',
  data?: Record<string, any>
) {
  if (isSentryActive) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

// Helper to manually trigger an intentional test error (e.g. for Sentry verification)
export function triggerTestError() {
  if (isSentryActive) {
    addBreadcrumb('Botão de teste disparado pelo usuário', 'test');
    captureError(new Error('Champs Manager: Erro de teste disparado com sucesso!'));
    return true;
  }
  return false;
}
