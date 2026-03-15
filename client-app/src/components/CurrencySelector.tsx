import { useState, useRef, useEffect } from 'react';
import type { Rate } from '../types';
import { CurrencyFlag } from './CurrencyFlag';

interface CurrencySelectorProps {
  rates: Rate[];
  value: string | null;
  onChange: (code: string) => void;
  placeholder?: string;
}

export function CurrencySelector({ rates, value, onChange, placeholder = 'Select currency...' }: CurrencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = value ? rates.find((r) => r.code === value) : null;

  const filtered = rates.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(code: string) {
    onChange(code);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      >
        {selected ? (
          <>
            <CurrencyFlag code={selected.code} size="lg" />
            <span className="font-semibold text-gray-900 dark:text-white">{selected.code}</span>
            <span className="text-gray-500 dark:text-gray-400 flex-1 text-left text-sm">{selected.name}</span>
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 flex-1 text-left">{placeholder}</span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currencies..."
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Currency list */}
          <ul className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No currencies found
              </li>
            ) : (
              filtered.map((rate) => (
                <li key={rate.code}>
                  <button
                    type="button"
                    onClick={() => handleSelect(rate.code)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      value === rate.code ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                  >
                    <span className="w-7 flex items-center justify-center"><CurrencyFlag code={rate.code} /></span>
                    <span className={`font-semibold text-sm w-10 shrink-0 ${value === rate.code ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {rate.code}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">{rate.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {rate.sellRate.toFixed(4)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
