import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import type { Rate } from '../types';
import type {ToastType} from '../components/Toast';

interface OutletCtx {
  push: (message: string, type?: ToastType) => void;
}

interface RatesPageProps {
  push?: (message: string, type?: ToastType) => void;
}

export function RatesPage({ push: pushProp }: RatesPageProps) {
  let push: (message: string, type?: ToastType) => void;
  try {
    const ctx = useOutletContext<OutletCtx>();
    push = pushProp ?? ctx.push;
  } catch {
    push = pushProp ?? (() => {});
  }

  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const prevRatesRef = useRef<Map<string, Rate>>(new Map());
  const socket = useSocket();
  const token = localStorage.getItem('bureau_admin_token');

  // API returns { base, rates: [{ currency_code, name, flag_emoji, buy_rate, sell_rate, market_rate, last_updated }] }
  // Transform to admin Rate type: { currency_code, currency_name, flag, ..., last_fetched }
  function toAdminRate(r: any): Rate {
    return {
      currency_code: r.currency_code,
      currency_name: r.name ?? r.currency_name,
      flag: r.flag_emoji ?? r.flag,
      market_rate: r.market_rate,
      buy_rate: r.buy_rate,
      sell_rate: r.sell_rate,
      last_fetched: r.last_updated ?? r.last_fetched ?? '',
    };
  }

  const fetchRates = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/rates', { headers });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.rates ?? []).map(toAdminRate);
        setRates(mapped);
        prevRatesRef.current = new Map(mapped.map((r: Rate) => [r.currency_code, r]));
      } else {
        push('Failed to load rates', 'error');
      }
    } catch {
      push('Network error loading rates', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  useSocketEvent<any>('rates:updated', (payload) => {
    const rawRates = payload?.rates ?? (Array.isArray(payload) ? payload : []);
    const updatedRates = rawRates.map(toAdminRate);
    const changed = new Set<string>();
    updatedRates.forEach((r: Rate) => {
      const prev = prevRatesRef.current.get(r.currency_code);
      if (!prev || prev.buy_rate !== r.buy_rate || prev.sell_rate !== r.sell_rate) {
        changed.add(r.currency_code);
      }
    });

    setRates(updatedRates);
    prevRatesRef.current = new Map(updatedRates.map((r: Rate) => [r.currency_code, r]));

    if (changed.size > 0) {
      setFlashIds(prev => new Set([...prev, ...changed]));
      setTimeout(() => {
        setFlashIds(prev => {
          const next = new Set(prev);
          changed.forEach(id => next.delete(id));
          return next;
        });
      }, 1500);
    }
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/rates/refresh', { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.rates ?? []).map(toAdminRate);
        setRates(mapped);
        prevRatesRef.current = new Map(mapped.map((r: Rate) => [r.currency_code, r]));
        push('Rates refreshed successfully', 'success');
      } else {
        push('Failed to refresh rates', 'error');
      }
    } catch {
      push('Network error refreshing rates', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  function formatRate(n: number) {
    return n.toFixed(4);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-600'}`} />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh Rates'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : rates.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            No rates available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-5 py-3 font-medium">Currency</th>
                  <th className="px-5 py-3 font-medium text-right">Market Rate</th>
                  <th className="px-5 py-3 font-medium text-right">Buy Rate</th>
                  <th className="px-5 py-3 font-medium text-right">Sell Rate</th>
                  <th className="px-5 py-3 font-medium text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rates.map(rate => (
                  <tr
                    key={rate.currency_code}
                    className={`transition-colors duration-500 ${
                      flashIds.has(rate.currency_code)
                        ? 'bg-emerald-50 dark:bg-emerald-950'
                        : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{rate.flag}</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{rate.currency_code}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{rate.currency_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-900 dark:text-white">
                      {formatRate(rate.market_rate)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-blue-700 dark:text-blue-400">
                      {formatRate(rate.buy_rate)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-orange-700 dark:text-orange-400">
                      {formatRate(rate.sell_rate)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400 text-xs">
                      {formatTime(rate.last_fetched)}
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
