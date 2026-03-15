import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

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
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
