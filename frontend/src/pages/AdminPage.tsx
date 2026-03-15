import { useState } from 'react';
import { useRates }         from '../hooks/useRates';
import { useTillInventory, useTransactions } from '../hooks/useTill';
import { useToast }         from '../components/Toast';

interface Props {
  push: ReturnType<typeof useToast>['push'];
}

export function AdminPage({ push }: Props) {
  const { rates, loading: ratesLoading, lastFetch, refetch: refetchRates } = useRates();
  const [tillRefresh, setTillRefresh] = useState(0);
  const [txRefresh, setTxRefresh]     = useState(0);
  const { data: till, loading: tillLoading } = useTillInventory(tillRefresh);
  const { transactions, loading: txLoading } = useTransactions(txRefresh);

  // Restock form state
  const [restockCurrency, setRestockCurrency]       = useState('');
  const [restockDenom, setRestockDenom]             = useState('');
  const [restockQty, setRestockQty]                 = useState('');
  const [restockSubmitting, setRestockSubmitting]   = useState(false);

  // Active admin tab
  const [tab, setTab] = useState<'till' | 'transactions' | 'rates'>('rates');

  async function forceRefreshRates() {
    try {
      const res = await fetch('/api/rates/refresh', { method: 'POST' });
      if (res.ok) {
        await refetchRates();
        push('success', 'Rates refreshed');
      } else {
        push('error', 'Failed to refresh rates');
      }
    } catch {
      push('error', 'Network error');
    }
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!restockCurrency || !restockDenom || !restockQty) {
      push('error', 'Fill in all restock fields');
      return;
    }
    setRestockSubmitting(true);
    try {
      const res = await fetch('/api/till/restock', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          currency:     restockCurrency.toUpperCase(),
          denominations: { [restockDenom]: parseInt(restockQty, 10) },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push('success', `Restocked ${restockCurrency.toUpperCase()} ${restockDenom}`);
        setTillRefresh((n) => n + 1);
        setRestockDenom('');
        setRestockQty('');
      } else {
        push('error', data.error ?? 'Restock failed');
      }
    } catch {
      push('error', 'Network error');
    } finally {
      setRestockSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bureau Admin</h1>
        <button
          onClick={forceRefreshRates}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          ↻ Force Refresh Rates
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 bg-gray-100 dark:bg-gray-800">
        {(['rates', 'till', 'transactions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t === 'rates' ? '📈 Live Rates' : t === 'till' ? '🏦 Till Inventory' : '📋 Transactions'}
          </button>
        ))}
      </div>

      {/* ───── Live Rates Tab ───── */}
      {tab === 'rates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{rates.length} currencies · base CAD</span>
            {lastFetch && <span>Last updated: {lastFetch.toLocaleTimeString()}</span>}
          </div>
          {ratesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <Th>Currency</Th>
                    <Th align="right">Market Rate</Th>
                    <Th align="right">Buy Rate</Th>
                    <Th align="right">Sell Rate</Th>
                    <Th align="right">Margin</Th>
                    <Th align="right">Updated</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rates.map((r) => {
                    const margin = ((r.sell_rate - r.buy_rate) / r.market_rate * 100).toFixed(2);
                    return (
                      <tr key={r.currency_code} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                          <span className="text-lg">{r.flag_emoji}</span>
                          <span>{r.currency_code}</span>
                          <span className="text-gray-400 font-normal hidden sm:inline">{r.name}</span>
                        </td>
                        <Td align="right" mono>{r.market_rate.toFixed(4)}</Td>
                        <Td align="right" mono className="text-blue-600 dark:text-blue-400">{r.buy_rate.toFixed(4)}</Td>
                        <Td align="right" mono className="text-emerald-600 dark:text-emerald-400">{r.sell_rate.toFixed(4)}</Td>
                        <Td align="right" mono className="text-gray-500">{margin}%</Td>
                        <Td align="right" className="text-gray-400 text-xs">
                          {new Date(r.last_updated).toLocaleTimeString()}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───── Till Inventory Tab ───── */}
      {tab === 'till' && (
        <div className="space-y-6">
          {/* Restock form */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Restock Till</h2>
            <form onSubmit={handleRestock} className="flex flex-wrap gap-3">
              <input
                placeholder="Currency (USD)"
                value={restockCurrency}
                onChange={(e) => setRestockCurrency(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
              <input
                placeholder="Denomination (100)"
                value={restockDenom}
                onChange={(e) => setRestockDenom(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
              <input
                type="number"
                placeholder="Quantity (50)"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                min={0}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
              <button
                type="submit"
                disabled={restockSubmitting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {restockSubmitting ? 'Restocking…' : 'Restock'}
              </button>
            </form>
          </div>

          {/* Till table */}
          {tillLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : till?.summary ? (
            <div className="space-y-4">
              {till.summary.map((currency) => (
                <div key={currency.code} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xl">{currency.flagEmoji}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{currency.code}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{currency.name}</span>
                    <span className="ml-auto text-sm font-mono text-gray-500 dark:text-gray-400">
                      Total: {currency.totalFaceValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3">
                    {currency.denominations.map(({ denomination, quantity }) => (
                      <div
                        key={denomination}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                          quantity === 0
                            ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                            : quantity < 10
                            ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                            : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="font-mono font-semibold">{formatDenom(denomination)}</span>
                        <span className="text-xs opacity-70">×{quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No till data</p>
          )}
        </div>
      )}

      {/* ───── Transactions Tab ───── */}
      {tab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last {transactions.length} transactions
            </span>
            <button
              onClick={() => setTxRefresh((n) => n + 1)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ↻ Refresh
            </button>
          </div>

          {txLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              No transactions yet
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <Th>ID</Th>
                    <Th>Type</Th>
                    <Th>Currency</Th>
                    <Th align="right">Foreign</Th>
                    <Th align="right">CAD</Th>
                    <Th align="right">Rate</Th>
                    <Th align="right">Time</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {transactions.map((t) => (
                    <tr key={t.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <Td mono className="text-gray-400 text-xs">{t.transaction_id.slice(0, 8)}</Td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                          t.type === 'sell'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {t.type === 'sell' ? 'SELL' : 'BUY'}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-1.5">
                        <span>{t.flag_emoji}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{t.currency_code}</span>
                      </td>
                      <Td align="right" mono>{t.amount_foreign.toLocaleString()}</Td>
                      <Td align="right" mono className="font-semibold text-gray-900 dark:text-white">
                        {t.amount_cad.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Td>
                      <Td align="right" mono className="text-gray-500">{t.rate_used.toFixed(4)}</Td>
                      <Td align="right" className="text-gray-400 text-xs">
                        {new Date(t.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-${align}`}>
      {children}
    </th>
  );
}

function Td({
  children, align = 'left', mono = false, className = '',
}: {
  children: React.ReactNode; align?: string; mono?: boolean; className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-${align} ${mono ? 'font-mono' : ''} ${className}`}>
      {children}
    </td>
  );
}

function formatDenom(d: number): string {
  if (d >= 1000) return d.toLocaleString();
  if (Number.isInteger(d)) return String(d);
  return d.toFixed(2);
}
