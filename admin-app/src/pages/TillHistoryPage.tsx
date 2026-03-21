import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ToastType } from '../components/Toast';

interface OutletCtx {
  push: (message: string, type?: ToastType) => void;
}

interface TillHistoryEntry {
  id: number;
  currency: string;
  changeType: string;
  denomination: number | null;
  quantityBefore: number;
  quantityAfter: number;
  quantityDelta: number;
  performedBy: string;
  note: string | null;
  createdAt: string;
}

const PAGE_SIZE = 25;

export function TillHistoryPage() {
  let push: (message: string, type?: ToastType) => void;
  try {
    const ctx = useOutletContext<OutletCtx>();
    push = ctx.push;
  } catch {
    push = () => {};
  }

  const [entries, setEntries] = useState<TillHistoryEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterCurrency,   setFilterCurrency]   = useState('');
  const [filterChangeType, setFilterChangeType] = useState('');

  const token = localStorage.getItem('bureau_admin_token');

  const fetchHistory = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCurrency)   params.set('currency',   filterCurrency);
      if (filterChangeType) params.set('changeType', filterChangeType);
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String((pg - 1) * PAGE_SIZE));

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/till/history?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
      } else {
        push('Failed to load till history', 'error');
      }
    } catch {
      push('Network error loading till history', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterCurrency, filterChangeType, token, push]);

  useEffect(() => {
    fetchHistory(page);
  }, [page, filterCurrency, filterChangeType, fetchHistory]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  const changeTypeColor = (t: string) => {
    if (t === 'DEPOSIT')    return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
    if (t === 'WITHDRAWAL') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
    return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Currency</label>
            <input
              type="text"
              value={filterCurrency}
              onChange={e => { setFilterCurrency(e.target.value.toUpperCase()); setPage(1); }}
              placeholder="e.g. USD"
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Change Type</label>
            <select
              value={filterChangeType}
              onChange={e => { setFilterChangeType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            No history entries found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Currency</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Denomination</th>
                    <th className="px-4 py-3 font-medium text-right">Change</th>
                    <th className="px-4 py-3 font-medium">Performed by</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {entries.map(entry => (
                    <tr key={entry.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {entry.currency}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${changeTypeColor(entry.changeType)}`}>
                          {entry.changeType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">
                        {entry.denomination != null ? entry.denomination : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        <span className={entry.quantityDelta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {entry.quantityDelta >= 0 ? '+' : ''}{entry.quantityDelta}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                          ({entry.quantityBefore} → {entry.quantityAfter})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {entry.performedBy}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {entry.note ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
