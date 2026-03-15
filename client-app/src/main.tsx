import * as Sentry from '@sentry/react';
import { StrictMode, Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.MODE as string,
  integrations: [Sentry.browserTracingIntegration()],
  // 10 % of transactions in production, 100 % in dev/preview
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', e, info.componentStack); }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error;
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
          <div style={{ maxWidth: 480, width: '100%', background: '#fff', border: '1px solid #fee2e2', borderRadius: 16, padding: '2rem' }}>
            <div style={{ marginBottom: 12 }}><AlertTriangle style={{ width: 36, height: 36, color: '#dc2626' }} /></div>
            <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Something went wrong</h1>
            <pre style={{ background: '#fef2f2', borderRadius: 8, padding: 12, fontSize: 11, color: '#dc2626', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 16px' }}>{e.message}</pre>
            <button onClick={() => window.location.reload()} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
