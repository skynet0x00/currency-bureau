import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { CurrencyFlag } from '../components/CurrencyFlag';
import type { ToastType } from '../components/Toast';

interface OutletCtx {
  push: (message: string, type?: ToastType) => void;
}

interface TillPageProps {
  push?: (message: string, type?: ToastType) => void;
}

interface DenomRow {
  denomination: number;
  quantity: number;
}

interface TillEntry {
  currency_code: string;
  currency_name: string;
  flag: string;
  denominations: DenomRow[];
}

interface EditState {
  currency: string;
  denomination: number;
  value: string;
}

interface TillSummaryApiItem {
  code: string;
  name: string;
  flagEmoji: string;
  denominations?: DenomRow[];
}

export function TillPage({ push: pushProp }: TillPageProps) {
  let push: (message: string, type?: ToastType) => void;
  try {
    const ctx = useOutletContext<OutletCtx>();
    push = pushProp ?? ctx.push;
  } catch {
    push = pushProp ?? (() => {});
  }

  const [till, setTill] = useState<TillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const socket = useSocket();
  const token = localStorage.getItem('bureau_admin_token');

  const fetchTill = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/till', { headers });
      if (res.ok) {
        const data = await res.json();
        setTill((data.summary ?? []).map((s: TillSummaryApiItem) => ({
          currency_code: s.code,
          currency_name: s.name,
          flag: s.flagEmoji,
          denominations: s.denominations ?? [],
        })));
      } else {
        push('Failed to load till data', 'error');
      }
    } catch {
      push('Network error loading till', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, push]);

  useEffect(() => { fetchTill(); }, [fetchTill]);

  useEffect(() => {
    if (edit && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [edit]);

  // Focus search on mount
  useEffect(() => {
    if (!loading && !selectedCode && searchRef.current) {
      searchRef.current.focus();
    }
  }, [loading, selectedCode]);

  useSocketEvent('till:updated', () => {
    fetchTill();
  });

  function startEdit(currency: string, denomination: number, currentQty: number) {
    setEdit({ currency, denomination, value: String(currentQty) });
  }

  function cancelEdit() {
    setEdit(null);
  }

  async function saveEdit() {
    if (!edit) return;
    const qty = parseInt(edit.value, 10);
    if (isNaN(qty) || qty < 0) {
      push('Quantity must be a non-negative integer', 'error');
      return;
    }
    setSaving(true);
    try {
      socket.emit('admin:restock', {
        currency: edit.currency,
        denominations: { [edit.denomination]: qty },
      });
      setTill(prev =>
        prev.map(entry =>
          entry.currency_code === edit.currency
            ? {
                ...entry,
                denominations: entry.denominations.map(d =>
                  d.denomination === edit.denomination ? { ...d, quantity: qty } : d
                ),
              }
            : entry
        )
      );
      push(`Updated ${edit.currency} ${edit.denomination} → ${qty}`, 'success');
      setEdit(null);
    } catch {
      push('Failed to save restock', 'error');
    } finally {
      setSaving(false);
    }
  }

  function qtyClass(qty: number) {
    if (qty === 0) return 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400';
    if (qty < 10) return 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400';
    return 'text-gray-900 dark:text-white';
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const filtered = till.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.currency_code.toLowerCase().includes(q) || e.currency_name.toLowerCase().includes(q);
  });

  const selectedEntry = selectedCode ? till.find(e => e.currency_code === selectedCode) ?? null : null;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-11 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Detail view (currency selected) ───────────────────────────────────────

  if (selectedEntry) {
    return (
      <div className="space-y-4">
        {/* Back bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { setSelectedCode(null); setEdit(null); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            Click any quantity to edit inline · changes broadcast via socket
          </p>
          <button
            onClick={fetchTill}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Denomination table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <CurrencyFlag code={selectedEntry.currency_code} size="lg" />
            <span className="font-semibold text-gray-900 dark:text-white">{selectedEntry.currency_code}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{selectedEntry.currency_name}</span>
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              {selectedEntry.denominations.length} denominations
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-2.5 font-medium">Denomination</th>
                  <th className="px-5 py-2.5 font-medium">Quantity</th>
                  <th className="px-5 py-2.5 font-medium">Total Value</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {selectedEntry.denominations
                  .slice()
                  .sort((a, b) => b.denomination - a.denomination)
                  .map(denom => {
                    const isEditing =
                      edit?.currency === selectedEntry.currency_code &&
                      edit?.denomination === denom.denomination;
                    const cellClass = qtyClass(denom.quantity);

                    return (
                      <tr
                        key={denom.denomination}
                        className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-5 py-3 font-mono font-medium text-gray-900 dark:text-white">
                          {selectedEntry.currency_code} {denom.denomination.toLocaleString('en-CA', { minimumFractionDigits: denom.denomination % 1 !== 0 ? 2 : 0 })}
                        </td>
                        <td className="px-5 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                ref={inputRef}
                                type="number"
                                min={0}
                                value={edit!.value}
                                onChange={e => setEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="w-24 px-2 py-1 text-sm rounded border bg-white dark:bg-gray-800 border-emerald-400 dark:border-emerald-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="px-2 py-1 text-xs font-medium bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                              >
                                {saving ? '…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(selectedEntry.currency_code, denom.denomination, denom.quantity)}
                              className={`px-3 py-1 rounded font-mono font-semibold cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all ${cellClass}`}
                              title="Click to edit"
                            >
                              {denom.quantity}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono text-gray-700 dark:text-gray-300">
                          {selectedEntry.currency_code} {(denom.denomination * denom.quantity).toLocaleString('en-CA', { minimumFractionDigits: denom.denomination % 1 !== 0 ? 2 : 0 })}
                        </td>
                        <td className="px-5 py-3">
                          {denom.quantity === 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400">
                              Out of stock
                            </span>
                          ) : denom.quantity < 10 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Search / browse view ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Search bar + refresh */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition-all">
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code or name — USD, euro, dirham…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={fetchTill}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Currency list */}
      {till.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          No till data available.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          No currencies match <span className="font-semibold text-gray-600 dark:text-gray-300">"{search}"</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const hasOut  = entry.denominations.some(d => d.quantity === 0);
            const hasLow  = !hasOut && entry.denominations.some(d => d.quantity < 10);
            return (
              <button
                key={entry.currency_code}
                onClick={() => setSelectedCode(entry.currency_code)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 text-left transition-all group"
              >
                <CurrencyFlag code={entry.currency_code} size="lg" />
                <span className="font-semibold text-gray-900 dark:text-white w-12 shrink-0">{entry.currency_code}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">{entry.currency_name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{entry.denominations.length} denoms</span>
                {hasOut && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 font-medium shrink-0">
                    Out
                  </span>
                )}
                {hasLow && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-medium shrink-0">
                    Low
                  </span>
                )}
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
