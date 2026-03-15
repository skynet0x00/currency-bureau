import type { DenominationInfo } from '../types';

interface Props {
  denominations: DenominationInfo[];
  selected:      Record<string, number>; // denomination (string) -> qty
  onChange:      (d: Record<string, number>) => void;
  mode:          'buy' | 'sell'; // sell: show available qty in till
}

export function DenominationPicker({ denominations, selected, onChange, mode }: Props) {
  function setQty(denom: number, qty: number) {
    const key = String(denom);
    if (qty === 0) {
      const next = { ...selected };
      delete next[key];
      onChange(next);
    } else {
      onChange({ ...selected, [key]: qty });
    }
  }

  const totalFx = Object.entries(selected).reduce(
    (sum, [d, q]) => sum + parseFloat(d) * q,
    0
  );

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {mode === 'sell'
          ? 'Select denominations to receive (till availability shown)'
          : 'Enter denominations you are handing over'}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {denominations.map(({ denomination, quantity }) => {
          const key   = String(denomination);
          const qty   = selected[key] ?? 0;
          const maxQty = mode === 'sell' ? quantity : 9999;
          const isActive = qty > 0;

          return (
            <div
              key={denomination}
              className={`rounded-xl border-2 p-3 transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              } ${mode === 'sell' && quantity === 0 ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  {formatDenom(denomination)}
                </span>
                {mode === 'sell' && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">×{quantity}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQty(denomination, Math.max(0, qty - 1))}
                  disabled={qty === 0}
                  className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={maxQty}
                  value={qty || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const v = parseInt(e.target.value || '0', 10);
                    if (!isNaN(v)) setQty(denomination, Math.min(v, maxQty));
                  }}
                  className="w-12 text-center text-sm font-mono bg-transparent text-gray-900 dark:text-white focus:outline-none"
                />
                <button
                  onClick={() => setQty(denomination, Math.min(qty + 1, maxQty))}
                  disabled={mode === 'sell' && qty >= quantity}
                  className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {totalFx > 0 && (
        <div className="text-right text-sm font-medium text-blue-600 dark:text-blue-400">
          Total: {totalFx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}

function formatDenom(d: number): string {
  if (d >= 1000) return d.toLocaleString();
  if (Number.isInteger(d)) return String(d);
  return d.toFixed(2);
}
