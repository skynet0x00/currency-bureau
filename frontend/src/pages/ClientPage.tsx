import { useState, useEffect, useRef } from 'react';
import { CurrencySelector } from '../components/CurrencySelector';
import { RateDisplay }      from '../components/RateDisplay';
import { DenominationPicker } from '../components/DenominationPicker';
import { Receipt }           from '../components/Receipt';
import { useRates, useRateForCurrency } from '../hooks/useRates';
import { useDenominations }  from '../hooks/useTill';
import type { Currency, TransactionResponse } from '../types';
import { useToast }          from '../components/Toast';

interface Props {
  currencies: Currency[];
  push:       ReturnType<typeof useToast>['push'];
}

export function ClientPage({ currencies, push }: Props) {
  const { rates, loading: ratesLoading, lastFetch } = useRates();

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [mode, setMode] = useState<'buy' | 'sell'>('sell'); // default: buy foreign (sell = bureau sells)
  const [amountFx, setAmountFx] = useState<string>('');
  const [denominations, setDenominations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<TransactionResponse | null>(null);

  const { data: denomData, loading: denomLoading } = useDenominations(selectedCurrency);
  const rate = useRateForCurrency(rates, selectedCurrency);

  // Debounce amount input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayAmount, setDisplayAmount] = useState('');

  function handleAmountChange(val: string) {
    setDisplayAmount(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setAmountFx(val), 300);
  }

  // Sync amount from denomination picker
  useEffect(() => {
    const total = Object.entries(denominations).reduce(
      (sum, [d, q]) => sum + parseFloat(d) * q, 0
    );
    if (total > 0) {
      const s = total.toFixed(2).replace(/\.00$/, '');
      setDisplayAmount(s);
      setAmountFx(s);
    }
  }, [denominations]);

  // Reset denominations when currency changes
  useEffect(() => {
    setDenominations({});
    setAmountFx('');
    setDisplayAmount('');
  }, [selectedCurrency, mode]);

  const parsedAmount = parseFloat(amountFx) || 0;
  const activeRate   = rate ? (mode === 'sell' ? rate.sell_rate : rate.buy_rate) : null;
  const cadAmount    = activeRate && parsedAmount > 0
    ? (parsedAmount / activeRate).toFixed(2)
    : null;

  async function handleSubmit() {
    if (!selectedCurrency || !parsedAmount || !Object.keys(denominations).length) {
      push('error', 'Please fill in all fields and select denominations');
      return;
    }

    // Verify denom sum
    const denomSum = Object.entries(denominations).reduce(
      (sum, [d, q]) => sum + parseFloat(d) * q, 0
    );
    if (Math.abs(denomSum - parsedAmount) > 0.01) {
      push('error', `Denomination total (${denomSum.toFixed(2)}) doesn't match amount (${parsedAmount})`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:           mode,
          currency:       selectedCurrency,
          amount_foreign: parsedAmount,
          denominations,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        push('error', data.error ?? 'Transaction failed');
        return;
      }
      setReceipt(data);
      setDenominations({});
      setAmountFx('');
      setDisplayAmount('');
      push('success', 'Transaction processed successfully');
    } catch {
      push('error', 'Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const currentCurrency = currencies.find((c) => c.code === selectedCurrency) ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Currency Exchange</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Live rates · CAD base · Bureau margins applied
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl p-1 bg-gray-100 dark:bg-gray-800 gap-1">
        {(['sell', 'buy'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              mode === m
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {m === 'sell' ? '🛒 Buy Foreign Currency' : '💰 Sell Foreign Currency'}
          </button>
        ))}
      </div>

      {/* Currency selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Currency
        </label>
        <CurrencySelector
          currencies={currencies}
          selected={selectedCurrency}
          onSelect={setSelectedCurrency}
        />
      </div>

      {/* Rate display */}
      <RateDisplay
        rate={rate}
        mode={mode}
        loading={ratesLoading}
        lastFetch={lastFetch}
      />

      {/* Amount input */}
      {selectedCurrency && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount ({selectedCurrency})
          </label>
          <div className="relative">
            <input
              type="number"
              min={0}
              step="any"
              value={displayAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder={`e.g. 500`}
              className="w-full px-4 py-3 pr-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
              {selectedCurrency}
            </span>
          </div>
        </div>
      )}

      {/* CAD preview */}
      {cadAmount && (
        <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 flex items-center justify-between">
          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
            {mode === 'sell' ? 'You pay' : 'You receive'}
          </span>
          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
            CA${parseFloat(cadAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Denomination picker */}
      {selectedCurrency && !denomLoading && denomData && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Denomination Breakdown
          </label>
          <DenominationPicker
            denominations={denomData.denominations}
            selected={denominations}
            onChange={setDenominations}
            mode={mode}
          />
        </div>
      )}
      {denomLoading && (
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !selectedCurrency || !parsedAmount || Object.keys(denominations).length === 0}
        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg transition-all active:scale-[0.98]"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Processing…
          </span>
        ) : (
          `Confirm ${mode === 'sell' ? 'Purchase' : 'Sale'}`
        )}
      </button>

      {/* Receipt modal */}
      {receipt && (
        <Receipt
          tx={receipt}
          currency={currentCurrency}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
