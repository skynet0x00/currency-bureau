import type { DenominationInfo } from '../types';

export interface DenominationQty {
  value: number;
  quantity: number;
}

interface DenominationPickerProps {
  denominations: DenominationInfo[];
  quantities: DenominationQty[];
  onChange: (quantities: DenominationQty[]) => void;
  mode: 'buy' | 'sell'; // bureau perspective: buy = client selling foreign, sell = client buying foreign
  currencyCode: string;
}

export function DenominationPicker({ denominations, quantities, onChange, mode, currencyCode }: DenominationPickerProps) {
  function getQty(value: number): number {
    return quantities.find((q) => q.value === value)?.quantity ?? 0;
  }

  function setQty(value: number, qty: number) {
    const denom = denominations.find((d) => d.value === value);
    const maxQty = mode === 'sell' ? (denom?.availableInTill ?? 999) : 999;
    const clamped = Math.max(0, Math.min(qty, maxQty));
    const existing = quantities.find((q) => q.value === value);
    if (existing) {
      if (clamped === 0) {
        onChange(quantities.filter((q) => q.value !== value));
      } else {
        onChange(quantities.map((q) => q.value === value ? { ...q, quantity: clamped } : q));
      }
    } else if (clamped > 0) {
      onChange([...quantities, { value, quantity: clamped }]);
    }
  }

  function handleInput(value: number, raw: string) {
    const parsed = parseInt(raw, 10);
    setQty(value, isNaN(parsed) ? 0 : parsed);
  }

  const totalForeign = quantities.reduce((sum, q) => sum + q.value * q.quantity, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Select Denominations
        </h3>
        {totalForeign > 0 && (
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Total: {totalForeign.toLocaleString()} {currencyCode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {denominations.map((denom) => {
          const qty = getQty(denom.value);
          const maxQty = mode === 'sell' ? denom.availableInTill : 999;
          const atMax = qty >= maxQty && maxQty !== 999;
          const isActive = qty > 0;

          return (
            <div
              key={denom.value}
              className={`rounded-xl border p-3 transition-all ${
                isActive
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
              }`}
            >
              {/* Denomination label */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className={`text-lg font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                    {denom.label}
                  </span>
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{currencyCode}</span>
                </div>
                {mode === 'sell' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    denom.availableInTill === 0
                      ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                      : denom.availableInTill <= 5
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}>
                    {denom.availableInTill === 0 ? 'Out' : `×${denom.availableInTill}`}
                  </span>
                )}
              </div>

              {/* Qty controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQty(denom.value, qty - 1)}
                  disabled={qty === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={maxQty === 999 ? undefined : maxQty}
                  value={qty === 0 ? '' : qty}
                  placeholder="0"
                  onChange={(e) => handleInput(denom.value, e.target.value)}
                  className="flex-1 w-0 text-center text-sm font-semibold rounded-lg py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setQty(denom.value, qty + 1)}
                  disabled={mode === 'sell' && denom.availableInTill === 0}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                    atMax
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  +
                </button>
              </div>

              {/* Subtotal */}
              {isActive && (
                <div className="mt-1.5 text-xs text-center text-blue-500 dark:text-blue-400 font-medium">
                  = {(qty * denom.value).toLocaleString()} {currencyCode}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {denominations.length === 0 && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          No denominations available
        </div>
      )}
    </div>
  );
}
