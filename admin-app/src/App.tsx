import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TillPage } from './pages/TillPage';
import { TillHistoryPage } from './pages/TillHistoryPage';
import { RatesPage } from './pages/RatesPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Layout } from './components/Layout';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

export default function App() {
  const auth = useAuth();
  const { toasts, push, remove } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : prefersDark);
  }, []);

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <LoginPage auth={auth} push={push} />
        <Toast toasts={toasts} onRemove={remove} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <BrowserRouter>
        <Routes>
          <Route element={<Layout auth={auth} push={push} />}>
            <Route index element={<DashboardPage push={push} />} />
            <Route path="/till" element={<TillPage push={push} />} />
            <Route path="/till-history" element={<TillHistoryPage />} />
            <Route path="/rates" element={<RatesPage push={push} />} />
            <Route path="/transactions" element={<TransactionsPage push={push} />} />
            <Route path="/settings" element={<SettingsPage push={push} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      <Toast toasts={toasts} onRemove={remove} />
    </div>
  );
}
