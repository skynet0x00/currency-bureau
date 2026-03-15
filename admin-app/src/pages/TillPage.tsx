import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import type {ToastType} from '../components/Toast';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const socket = useSocket();
  const token = localStorage.getItem('bureau_admin_token');

  const fetchTill = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/till', { headers });
      if (res.ok) {
        const data = await res.json();
        // API returns { summary: [{ code, name, flagEmoji, denominations }], inventory: [...] }
        setTill((data.summary ?? []).map((s: any) => ({
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
  }, [token]);

  useEffect(() => { fetchTill(); }, [fetchTill]);

  useEffect(() => {
    if (edit && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [edit]);

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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="h-5 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Click any quantity to edit inline. Changes are broadcast to all tills via socket.
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

      {till.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          No till data available.
        </div>
      ) : (
        <div className="space-y-4">
          {till.map(entry => (
            <div key={entry.currency_code} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <span className="text-xl">{entry.flag}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{entry.currency_code}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{entry.currency_name}</span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {entry.denominations.length} denominations
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
                    {entry.denominations
                      .slice()
                      .sort((a, b) => b.denomination - a.denomination)
                      .map(denom => {
                        const isEditing =
                          edit?.currency === entry.currency_code &&
                          edit?.denomination === denom.denomination;
                        const cellClass = qtyClass(denom.quantity);

                        return (
                          <tr
                            key={denom.denomination}
                            className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <td className="px-5 py-3 font-mono font-medium text-gray-900 dark:text-white">
                              {entry.currency_code} {denom.denomination.toLocaleString('en-CA', { minimumFractionDigits: denom.denomination % 1 !== 0 ? 2 : 0 })}
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
                                  onClick={() => startEdit(entry.currency_code, denom.denomination, denom.quantity)}
                                  className={`px-3 py-1 rounded font-mono font-semibold cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all ${cellClass}`}
                                  title="Click to edit"
                                >
                                  {denom.quantity}
                                </button>
                              )}
                            </td>
                            <td className="px-5 py-3 font-mono text-gray-700 dark:text-gray-300">
                              {entry.currency_code} {(denom.denomination * denom.quantity).toLocaleString('en-CA', { minimumFractionDigits: denom.denomination % 1 !== 0 ? 2 : 0 })}
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
          ))}
        </div>
      )}
    </div>
  );
}
