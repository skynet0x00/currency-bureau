import { useEffect } from 'react';
import { ExchangePage } from './pages/ExchangePage';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

export default function App() {
  const { toasts, push, remove } = useToast();

  useEffect(() => {
    // Apply saved theme on mount
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <ExchangePage push={push} />
      <Toast toasts={toasts} onRemove={remove} />
    </div>
  );
}
