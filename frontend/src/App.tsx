import { useState, useEffect } from 'react';
import { ClientPage }   from './pages/ClientPage';
import { AdminPage }    from './pages/AdminPage';
import { ThemeToggle }  from './components/ThemeToggle';
import { Toast, useToast } from './components/Toast';
import type { Currency } from './types';

type Page = 'client' | 'admin';

export default function App() {
  const [page, setPage] = useState<Page>('client');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const { toasts, push, remove } = useToast();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    fetch('/api/currencies')
      .then((r) => r.json())
      .then((data: any[]) =>
        setCurrencies(
          data.map((c) => ({
            code:       c.code,
            name:       c.name,
            flag_emoji: c.flag_emoji,
            is_active:  c.is_active,
          }))
        )
      )
      .catch(() => push('error', 'Failed to load currencies'));
  }, [push]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              💱
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white hidden sm:inline">
              Bureau Exchange
            </span>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <NavButton active={page === 'client'} onClick={() => setPage('client')}>
              Exchange
            </NavButton>
            <NavButton active={page === 'admin'}  onClick={() => setPage('admin')}>
              Admin
            </NavButton>
          </div>

          <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {page === 'client' ? (
          <ClientPage currencies={currencies} push={push} />
        ) : (
          <AdminPage push={push} />
        )}
      </main>

      <Toast toasts={toasts} onRemove={remove} />
    </div>
  );
}

function NavButton({
  children, active, onClick,
}: {
  children: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
        active
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}
