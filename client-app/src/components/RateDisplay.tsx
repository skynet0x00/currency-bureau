import type { Rate } from '../types';

interface RateDisplayProps {
  rate: Rate | null;
  secondsLeft: number;
  mode: 'buy' | 'sell'; // bureau perspective
}

export function RateDisplay({ rate, secondsLeft, mode }: RateDisplayProps) {
  if (!rate) return null;

  const activeRate = mode === 'buy' ? rate.buyRate : rate.sellRate;

  return (
    <div
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{rate.flag}</span>
          <span className="font-semibold text-gray-900 dark:text-white">{rate.code}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{rate.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ animation: 'fadeIn 0.5s ease-in-out infinite alternate' }}
          />
          Refreshes in {secondsLeft}s
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Buy rate (bureau buys = client sells) */}
        <div className={`rounded-lg p-3 border transition-all ${
          mode === 'buy'
            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800'
        }`}>
          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Bureau Buys</div>
          <div className={`text-base font-bold ${mode === 'buy' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
            {rate.buyRate.toFixed(4)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">CAD per {rate.code}</div>
        </div>

        {/* Sell rate (bureau sells = client buys) */}
        <div className={`rounded-lg p-3 border transition-all ${
          mode === 'sell'
            ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950'
            : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800'
        }`}>
          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Bureau Sells</div>
          <div className={`text-base font-bold ${mode === 'sell' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
            {rate.sellRate.toFixed(4)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">CAD per {rate.code}</div>
        </div>

        {/* Market rate */}
        <div className="rounded-lg p-3 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Market</div>
          <div className="text-base font-bold text-gray-900 dark:text-white">
            {rate.marketRate.toFixed(4)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">CAD per {rate.code}</div>
        </div>
      </div>

      {/* Active rate highlight */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Applied rate ({mode === 'buy' ? 'Bureau buys from you' : 'Bureau sells to you'}):
        </span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          1 {rate.code} = <span className="text-blue-600 dark:text-blue-400">{activeRate.toFixed(4)} CAD</span>
        </span>
      </div>
    </div>
  );
}
