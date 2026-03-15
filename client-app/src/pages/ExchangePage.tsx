import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { Rate, TransactionResponse } from '../types';
import { useRates } from '../hooks/useRates';
import { useDenominations } from '../hooks/useDenominations';
import { ThemeToggle } from '../components/ThemeToggle';
import { CurrencyFlag } from '../components/CurrencyFlag';
import { CurrencySelector } from '../components/CurrencySelector';
import { RateDisplay } from '../components/RateDisplay';
import { DenominationPicker } from '../components/DenominationPicker';
import type { DenominationQty } from '../components/DenominationPicker';
import { Receipt } from '../components/Receipt';
import type { ToastType } from '../components/Toast';

interface ExchangePageProps {
  push: (type: ToastType, message: string) => void;
}

// Client perspective modes — used in the UI
// "BUY" from client = client receives foreign, pays CAD = bureau type 'sell'
// "SELL" from client = client gives foreign, gets CAD = bureau type 'buy'
type ClientMode = 'buy' | 'sell';

function clientToBureauMode(clientMode: ClientMode): 'buy' | 'sell' {
  return clientMode === 'buy' ? 'sell' : 'buy';
}

export function ExchangePage({ push }: ExchangePageProps) {
  const { rates, loading: ratesLoading, error: ratesError, secondsLeft } = useRates();

  const [clientMode, setClientMode] = useState<ClientMode>('buy');
  const bureauMode = clientToBureauMode(clientMode);

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState(0);
  const [denomQtys, setDenomQtys] = useState<DenominationQty[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<TransactionResponse | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: denomData, loading: denomLoading } = useDenominations(selectedCurrency);

  const selectedRate: Rate | null = selectedCurrency
    ? rates.find((r) => r.code === selectedCurrency) ?? null
    : null;

  // Debounce amount input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const val = parseFloat(amountInput);
      setDebouncedAmount(isNaN(val) || val < 0 ? 0 : val);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [amountInput]);

  // Reset denominations when currency or mode changes
  useEffect(() => {
    setDenomQtys([]);
  }, [selectedCurrency, clientMode]);

  // Calculate CAD total
  const foreignAmountFromDenoms = denomQtys.reduce((sum, q) => sum + q.value * q.quantity, 0);
  // Use denomination total if it's non-zero, otherwise use manual input
  const foreignAmount = foreignAmountFromDenoms > 0 ? foreignAmountFromDenoms : debouncedAmount;

  const activeRate = selectedRate
    ? (bureauMode === 'buy' ? selectedRate.buyRate : selectedRate.sellRate)
    : 0;

  const cadTotal = activeRate > 0 ? foreignAmount / activeRate : 0;

  // Handle currency change
  function handleCurrencyChange(code: string) {
    setSelectedCurrency(code);
    setAmountInput('');
    setDebouncedAmount(0);
    setDenomQtys([]);
  }

  // Handle mode change
  function handleModeChange(mode: ClientMode) {
    setClientMode(mode);
    setDenomQtys([]);
  }

  const canConfirm = selectedCurrency !== null && foreignAmount > 0 && selectedRate !== null;

  async function handleSubmitTransaction() {
    if (!selectedCurrency || !selectedRate || foreignAmount === 0) return;

    // Build denominations map { "100": 4, "50": 2, ... } for the API
    const denomsMap: Record<string, number> = {};
    denomQtys.filter((q) => q.quantity > 0).forEach((q) => {
      denomsMap[String(q.value)] = q.quantity;
    });

    setSubmitting(true);
    try {
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: bureauMode,
          currency: selectedCurrency,
          amount_foreign: foreignAmount,
          denominations: denomsMap,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }
      const raw = await res.json();
      // Transform snake_case API response to camelCase TransactionResponse
      const txn: TransactionResponse = {
        transactionId: raw.transaction_id,
        type: raw.type,
        currencyCode: raw.currency ?? raw.currency_code,
        foreignAmount: raw.amount_foreign,
        cadAmount: raw.amount_cad,
        rate: raw.rate ?? raw.rate_used,
        denominations: Object.entries(
          raw.denominations_given ?? raw.denominations_received ?? raw.denominations ?? {}
        ).map(([value, qty]) => ({ value: parseFloat(value), quantity: qty as number })),
        createdAt: raw.timestamp ?? raw.created_at,
      };
      setCompletedTransaction(txn);
      setConfirmOpen(false);
      push('success', 'Transaction completed successfully!');
    } catch (e) {
      push('error', e instanceof Error ? e.message : 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewTransaction() {
    setCompletedTransaction(null);
    setSelectedCurrency(null);
    setAmountInput('');
    setDebouncedAmount(0);
    setDenomQtys([]);
    setClientMode('buy');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              ₵
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Bureau Exchange</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">Currency Kiosk</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Error banner */}
        {ratesError && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <span className="font-bold">!</span>
            Failed to load rates: {ratesError}. Retrying…
          </div>
        )}

        {/* Step 1: Buy / Sell toggle */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            I want to…
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('buy')}
              className={`flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border-2 transition-all font-medium text-sm ${
                clientMode === 'buy'
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">💵</span>
              <span className="font-semibold">Buy Foreign Currency</span>
              <span className="text-xs opacity-70">Pay CAD, receive foreign</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('sell')}
              className={`flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border-2 transition-all font-medium text-sm ${
                clientMode === 'sell'
                  ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">🏦</span>
              <span className="font-semibold">Sell Foreign Currency</span>
              <span className="text-xs opacity-70">Give foreign, receive CAD</span>
            </button>
          </div>
        </div>

        {/* Step 2: Currency selector */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Select Currency
          </h2>
          {ratesLoading ? (
            <div className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : (
            <CurrencySelector
              rates={rates}
              value={selectedCurrency}
              onChange={handleCurrencyChange}
              placeholder="Search for a currency…"
            />
          )}
        </div>

        {/* Step 3: Rate display */}
        {selectedRate && (
          <div
            style={{ animation: 'slideUp 0.2s ease-out' }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
          >
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Exchange Rate
            </h2>
            <RateDisplay rate={selectedRate} secondsLeft={secondsLeft} mode={bureauMode} />
          </div>
        )}

        {/* Step 4: Amount + Denominations */}
        {selectedCurrency && selectedRate && (
          <div
            style={{ animation: 'slideUp 0.2s ease-out' }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-5"
          >
            {/* Manual amount input */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Amount ({selectedCurrency})
              </h2>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-gray-500">
                  {selectedCurrency}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setDenomQtys([]); // clear denoms when typing manually
                  }}
                  placeholder="0.00"
                  className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-colors"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                Or use the denomination picker below to select exact bills/coins
              </p>
            </div>

            {/* Denomination picker */}
            {denomLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : denomData && denomData.denominations.length > 0 ? (
              <DenominationPicker
                denominations={denomData.denominations}
                quantities={denomQtys}
                onChange={(qs) => {
                  setDenomQtys(qs);
                  // clear manual input when using denom picker
                  if (qs.length > 0) setAmountInput('');
                }}
                mode={bureauMode}
                currencyCode={selectedCurrency}
              />
            ) : null}
          </div>
        )}

        {/* Step 5: CAD total + Confirm */}
        {selectedCurrency && selectedRate && (
          <div
            style={{ animation: 'slideUp 0.25s ease-out' }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
          >
            {/* Summary */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {clientMode === 'buy' ? 'You will pay' : 'You will receive'}
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {foreignAmount > 0
                    ? `$${cadTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`
                    : <span className="text-gray-300 dark:text-gray-700">$0.00 CAD</span>
                  }
                </p>
                {foreignAmount > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {foreignAmount.toLocaleString()} {selectedCurrency} ÷ {activeRate.toFixed(4)} = {cadTotal.toFixed(2)} CAD
                  </p>
                )}
              </div>
              <div className="text-4xl">
                {clientMode === 'buy' ? '💵' : '🏦'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canConfirm}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {canConfirm ? 'Review Transaction' : 'Enter amount to continue'}
            </button>
          </div>
        )}
      </main>

      {/* Confirmation modal */}
      {confirmOpen && selectedRate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/50 dark:bg-black/70">
          <div
            style={{ animation: 'slideUp 0.2s ease-out' }}
            className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Confirm Transaction</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Please review the details before proceeding.</p>

            <div className="space-y-3 mb-6">
              <ConfirmRow label="Transaction" value={clientMode === 'buy' ? 'Buying Foreign Currency' : 'Selling Foreign Currency'} />
              <ConfirmRow label="Currency" value={<span className="flex items-center gap-1.5"><CurrencyFlag code={selectedRate.code} /> {selectedRate.code} — {selectedRate.name}</span>} />
              <ConfirmRow label="Foreign Amount" value={`${foreignAmount.toLocaleString()} ${selectedCurrency}`} />
              <ConfirmRow label="Exchange Rate" value={`1 CAD = ${activeRate.toFixed(4)} ${selectedCurrency}`} />
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <ConfirmRow
                  label={clientMode === 'buy' ? 'Total You Pay' : 'Total You Receive'}
                  value={`$${cadTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`}
                  highlight
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitTransaction}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span
                      className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      style={{ animation: 'spin 0.7s linear infinite' }}
                    />
                    Processing…
                  </>
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {completedTransaction && (
        <Receipt
          transaction={completedTransaction}
          onNewTransaction={handleNewTransaction}
        />
      )}
    </div>
  );
}

function ConfirmRow({ label, value, highlight = false }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-blue-600 dark:text-blue-400 text-base' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </span>
    </div>
  );
}
