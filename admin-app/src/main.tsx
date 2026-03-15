import * as Sentry from '@sentry/react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.MODE as string,
  integrations: [Sentry.browserTracingIntegration()],
  // 10 % of transactions in production, 100 % in dev/preview
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
