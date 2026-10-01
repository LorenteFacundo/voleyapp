import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

function redact(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:\+?\d[\d ()-]{7,}\d)\b/g, '[contacto]')
    .replace(/(token|password|authorization|invite)=([^&\s]+)/gi, '$1=[redacted]');
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    tracesSampleRate: 0,
    beforeSend(event) {
      // Do not ship request data, browser breadcrumbs, identities, or free-form context.
      event.request = undefined;
      event.user = undefined;
      event.breadcrumbs = undefined;
      event.extra = undefined;
      if (event.message) event.message = redact(event.message);
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = redact(exception.value);
      }
      return event;
    },
  });
}

export function reportError(error: Error, componentStack?: string | null) {
  if (!dsn) return;
  Sentry.captureException(error, {
    ...(componentStack ? { contexts: { react: { componentStack: redact(componentStack) } } } : {}),
  });
}
