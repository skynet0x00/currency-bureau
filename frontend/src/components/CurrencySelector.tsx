import { useState } from 'react';
import type { Currency } from '../types';

interface Props {
  currencies: Currency[];
  selected:   string | null;
  onSelect:   (code: string) => void;
}

export function CurrencySelector({ currencies, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = currencies.filter(
    (c) =>
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase())
  );

  const current = currencies.find((c) => c.code === selected);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {current ? (
          <>
            <span className="text-2xl">{current.flag_emoji}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{current.code}</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">{current.name}</span>
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">Select currency…</span>
        )}
        <span className="ml-auto text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl animate-fade-in">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              type="text"
              placeholder="Search currencies…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-400 text-center">No currencies found</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code}>
                  <button
                    onClick={() => { onSelect(c.code); setOpen(false); setQuery(''); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${
                      c.code === selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <span className="text-xl">{c.flag_emoji}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{c.code}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{c.name}</span>
                    {c.code === selected && (
                      <span className="ml-auto text-blue-500 text-sm">✓</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setQuery(''); }} />
      )}
    </div>
  );
}
