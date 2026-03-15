import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Transaction, Currency } from '../types';
import type {ToastType} from '../components/Toast';

interface OutletCtx {
  push: (message: string, type?: ToastType) => void;
}

interface TransactionsPageProps {
  push?: (message: string, type?: ToastType) => void;
}

const PAGE_SIZE = 20;

// API returns snake_case with different field names — normalise to Transaction type
function toTransaction(raw: any): Transaction {
  return {
    id:               raw.transaction_id ?? raw.id,
    currency_code:    raw.currency_code ?? raw.currency,
    currency_name:    raw.currency_name,
    flag:             raw.flag_emoji ?? raw.flag,
    transaction_type: raw.type ?? raw.transaction_type,
    amount_foreign:   raw.amount_foreign,
    amount_cad:       raw.amount_cad,
    rate:             raw.rate_used ?? raw.rate,
    created_at:       raw.timestamp ?? raw.created_at,
  };
}

export function TransactionsPage({ push: pushProp }: TransactionsPageProps) {
  let push: (message: string, type?: ToastType) => void;
  try {
    const ctx = useOutletContext<OutletCtx>();
    push = pushProp ?? ctx.push;
  } catch {
    push = pushProp ?? (() => {});
  }

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const token = localStorage.getItem('bureau_admin_token');

  function buildQuery(overrides: Record<string, string | number> = {}) {
    const params = new URLSearchParams();
    const currency = overrides.currency !== undefined ? String(overrides.currency) : filterCurrency;
    const type     = overrides.type     !== undefined ? String(overrides.type)     : filterType;
    const from     = overrides.from     !== undefined ? String(overrides.from)     : filterFrom;
    const to       = overrides.to       !== undefined ? String(overrides.to)       : filterTo;
    const pg       = overrides.page     !== undefined ? Number(overrides.page)     : page;
    const limit    = overrides.limit    !== undefined ? Number(overrides.limit)    : PAGE_SIZE;

    if (currency) params.set('currency', currency);
    if (type)     params.set('type', type);
    if (from)     params.set('from', from);
    if (to)       params.set('to', to);
    params.set('limit', String(limit));
    params.set('offset', String((pg - 1) * limit));
    return params.toString();
  }

  const fetchTransactions = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const qs = buildQuery({ page: pg });
      const res = await fetch(`/api/transaction?${qs}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const raw: any[] = Array.isArray(data) ? data : (data.transactions ?? data.data ?? []);
        const mapped = raw.map(toTransaction);
        setTransactions(mapped);
        if (Array.isArray(data)) {
          setTotal(data.length < PAGE_SIZE ? (pg - 1) * PAGE_SIZE + data.length : pg * PAGE_SIZE + 1);
        } else {
          setTotal(data.total ?? data.count ?? mapped.length);
        }
      } else {
        push('Failed to load transactions', 'error');
      }
    } catch {
      push('Network error loading transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterCurrency, filterType, filterFrom, filterTo, token]);

  useEffect(() => {
    fetch('/api/currencies', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCurrencies(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTransactions(page);
  }, [page, filterCurrency, filterType, filterFrom, filterTo]);

  function applyFilters() {
    setPage(1);
    fetchTransactions(1);
  }

  function resetFilters() {
    setFilterCurrency('');
    setFilterType('');
    setFilterFrom('');
    setFilterTo('');
    setPage(1);
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const params = new URLSearchParams();
      if (filterCurrency) params.set('currency', filterCurrency);
      if (filterType)     params.set('type', filterType);
      if (filterFrom)     params.set('from', filterFrom);
      if (filterTo)       params.set('to', filterTo);
      params.set('limit', '500');
      params.set('offset', '0');
      const res = await fetch(`/api/transaction?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Fetch failed');
      const raw = await res.json();
      const data: Transaction[] = (Array.isArray(raw) ? raw : (raw.transactions ?? raw.data ?? [])).map(toTransaction);

      const cols = ['id', 'created_at', 'currency_code', 'transaction_type', 'amount_foreign', 'amount_cad', 'rate'];
      const rows = [cols.join(',')];
      data.forEach(tx => {
        rows.push([
          tx.id,
          tx.created_at,
          tx.currency_code,
          tx.transaction_type,
          tx.amount_foreign,
          tx.amount_cad,
          tx.rate,
        ].join(','));
      });

      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      push('CSV export downloaded', 'success');
    } catch {
      push('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatCAD(n: number) {
    return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Currency</label>
            <select
              value={filterCurrency}
              onChange={e => setFilterCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All currencies</option>
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.code} – {c.name}</option>
              ))}
            </select>
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          {/* From date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From date</label>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {/* To date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To date</label>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            Apply filters
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Reset
          </button>
          <div className="ml-auto">
            <button
              onClick={exportCSV}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            No transactions found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-5 py-3 font-medium">Currency</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium text-right">Foreign Amount</th>
                    <th className="px-5 py-3 font-medium text-right">CAD Amount</th>
                    <th className="px-5 py-3 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">
                        {tx.id.slice(0, 8)}…
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {formatTime(tx.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
                          <span>{tx.flag}</span>
                          <span>{tx.currency_code}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tx.transaction_type === 'buy'
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                            : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400'
                        }`}>
                          {tx.transaction_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-900 dark:text-white">
                        {tx.amount_foreign.toLocaleString('en-CA', { maximumFractionDigits: 2 })} {tx.currency_code}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-900 dark:text-white">
                        {formatCAD(tx.amount_cad)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-gray-500 dark:text-gray-400">
                        {tx.rate.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
                {total > 0 && ` · ${total} total`}
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
