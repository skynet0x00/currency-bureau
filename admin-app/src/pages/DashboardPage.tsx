import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSocketEvent } from '../hooks/useSocket';
import type { Transaction } from '../types';
import type {ToastType} from '../components/Toast';

interface OutletCtx {
  push: (message: string, type?: ToastType) => void;
}

interface DashboardPageProps {
  push?: (message: string, type?: ToastType) => void;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactElement;
  color: string;
  loading: boolean;
}

function MetricCard({ title, value, subtitle, icon, color, loading }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          )}
          {subtitle && !loading && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCAD(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export function DashboardPage({ push: pushProp }: DashboardPageProps) {
  let push: (message: string, type?: ToastType) => void;
  try {
    const ctx = useOutletContext<OutletCtx>();
    push = pushProp ?? ctx.push;
  } catch {
    push = pushProp ?? (() => {});
  }

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [metrics, setMetrics] = useState({
    txCount: 0,
    cadVolume: 0,
    topCurrency: '—',
    lowAlerts: 0,
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const token = localStorage.getItem('bureau_admin_token');

  const fetchData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [txRes, tillRes] = await Promise.all([
        fetch('/api/transaction?limit=100', { headers }),
        fetch('/api/till', { headers }),
      ]);

      if (txRes.ok) {
        const rawTx = await txRes.json();
        const txData: Transaction[] = (Array.isArray(rawTx) ? rawTx : (rawTx.transactions ?? [])).map(
          (raw: any): Transaction => ({
            id:               raw.transaction_id ?? raw.id,
            currency_code:    raw.currency_code ?? raw.currency,
            currency_name:    raw.currency_name,
            flag:             raw.flag_emoji ?? raw.flag,
            transaction_type: raw.type ?? raw.transaction_type,
            amount_foreign:   raw.amount_foreign,
            amount_cad:       raw.amount_cad,
            rate:             raw.rate_used ?? raw.rate,
            created_at:       raw.timestamp ?? raw.created_at,
          })
        );
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todayTx = txData.filter(t => t.created_at?.startsWith(todayStr));

        setTransactions(txData.slice(0, 20));
        setLoadingTx(false);

        const cadVol = todayTx.reduce((s, t) => s + (t.amount_cad ?? 0), 0);
        const currCounts: Record<string, number> = {};
        todayTx.forEach(t => { currCounts[t.currency_code] = (currCounts[t.currency_code] ?? 0) + 1; });
        const topCurrency = Object.entries(currCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

        setMetrics(prev => ({
          ...prev,
          txCount: todayTx.length,
          cadVolume: cadVol,
          topCurrency,
        }));
      }

      if (tillRes.ok) {
        const tillData = await tillRes.json();
        // API returns { summary: [{ code, denominations }], inventory: [...] }
        const summary: { denominations: { denomination: number; quantity: number }[] }[] =
          tillData.summary ?? (Array.isArray(tillData) ? tillData : []);
        let lowCount = 0;
        summary.forEach(c => c.denominations?.forEach(d => { if (d.quantity < 10) lowCount++; }));
        setMetrics(prev => ({ ...prev, lowAlerts: lowCount }));
      }

      setLoadingMetrics(false);
    } catch (err) {
      push('Failed to load dashboard data', 'error');
      setLoadingTx(false);
      setLoadingMetrics(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useSocketEvent<any>('transaction:new', (raw) => {
    const tx: Transaction = {
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
    setTransactions(prev => [tx, ...prev.slice(0, 19)]);
    setNewIds(prev => new Set(prev).add(tx.id));
    setTimeout(() => {
      setNewIds(prev => {
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });
    }, 2000);

    const todayStr = new Date().toLocaleDateString('en-CA');
    if (tx.created_at?.startsWith(todayStr)) {
      setMetrics(prev => ({
        ...prev,
        txCount: prev.txCount + 1,
        cadVolume: prev.cadVolume + (tx.amount_cad ?? 0),
      }));
    }
  });

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Transactions Today"
          value={metrics.txCount}
          loading={loadingMetrics}
          color="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <MetricCard
          title="CAD Volume Today"
          value={loadingMetrics ? '…' : formatCAD(metrics.cadVolume)}
          loading={loadingMetrics}
          color="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Most Exchanged"
          value={metrics.topCurrency}
          loading={loadingMetrics}
          color="bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          }
        />
        <MetricCard
          title="Low Till Alerts"
          value={metrics.lowAlerts}
          subtitle={metrics.lowAlerts > 0 ? 'Denominations need restock' : 'All stocked'}
          loading={loadingMetrics}
          color={metrics.lowAlerts > 0 ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Live transaction feed */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Live Transactions</h2>
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>

        {loadingTx ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            No transactions yet today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
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
                  <tr
                    key={tx.id}
                    className={`bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      newIds.has(tx.id) ? 'ring-2 ring-inset ring-emerald-400 dark:ring-emerald-500' : ''
                    }`}
                  >
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                      {formatTime(tx.created_at)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
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
                    <td className="px-5 py-3 text-right text-gray-900 dark:text-white font-mono">
                      {tx.amount_foreign.toLocaleString('en-CA', { maximumFractionDigits: 2 })} {tx.currency_code}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-900 dark:text-white font-mono">
                      {formatCAD(tx.amount_cad)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {tx.rate.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
