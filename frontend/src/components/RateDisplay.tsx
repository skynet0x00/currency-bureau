import type { Rate } from '../types';

interface Props {
  rate:       Rate | null;
  mode:       'buy' | 'sell';
  loading:    boolean;
  lastFetch:  Date | null;
}

export function RateDisplay({ rate, mode, loading, lastFetch }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-gray-100 dark:bg-gray-800 animate-pulse">
        <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-3" />
        <div className="h-8 w-48 bg-gray-300 dark:bg-gray-600 rounded" />
      </div>
    );
  }

  if (!rate) {
    return (
      <div className="rounded-2xl p-5 bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm">
        Select a currency to see rates
      </div>
    );
  }

  // mode: 'buy' = client sells to bureau (bureau buys) → use buy_rate
  //       'sell' = bureau sells to client → use sell_rate
  const activeRate = mode === 'buy' ? rate.buy_rate : rate.sell_rate;
  const label      = mode === 'buy' ? 'You Sell Rate' : 'You Buy Rate';
  const otherRate  = mode === 'buy' ? rate.sell_rate : rate.buy_rate;
  const otherLabel = mode === 'buy' ? 'Bureau Sell Rate' : 'Bureau Buy Rate';

  return (
    <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-100 dark:border-blue-900">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{label}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {lastFetch ? `Updated ${lastFetch.toLocaleTimeString()}` : ''}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-white font-mono">
          {activeRate.toFixed(4)}
        </span>
        <span className="text-lg text-gray-500 dark:text-gray-400">
          {rate.currency_code}/CAD
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{otherLabel}: <span className="font-mono">{otherRate.toFixed(4)}</span></span>
        <span className="opacity-50">·</span>
        <span>Market: <span className="font-mono">{rate.market_rate.toFixed(4)}</span></span>
      </div>
    </div>
  );
}
