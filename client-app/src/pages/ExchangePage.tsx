import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Building2, ArrowLeftRight, AlertCircle } from 'lucide-react';
import type { Rate, TransactionResponse } from '../types';
import { useRates } from '../hooks/useRates';
import { useDenominations } from '../hooks/useDenominations';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
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

// Client perspective modes
// "BUY" from client = client receives foreign, pays CAD = bureau type 'sell'
// "SELL" from client = client gives foreign, gets CAD = bureau type 'buy'
type ClientMode = 'buy' | 'sell';

function clientToBureauMode(clientMode: ClientMode): 'buy' | 'sell' {
  return clientMode === 'buy' ? 'sell' : 'buy';
}

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'AED', 'NZD'];

export function ExchangePage({ push }: ExchangePageProps) {
  const { t } = useTranslation();
  const { rates, loading: ratesLoading, error: ratesError, secondsLeft } = useRates();

  const [clientMode, setClientMode] = useState<ClientMode>('buy');
  const bureauMode = clientToBureauMode(clientMode);

  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState(0);
  const [denomQtys, setDenomQtys] = useState<DenominationQty[]>([]);

  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
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

  const foreignAmountFromDenoms = denomQtys.reduce((sum, q) => sum + q.value * q.quantity, 0);
  const foreignAmount = foreignAmountFromDenoms > 0 ? foreignAmountFromDenoms : debouncedAmount;

  const activeRate = selectedRate
    ? (bureauMode === 'buy' ? selectedRate.buyRate : selectedRate.sellRate)
    : 0;

  const cadTotal = activeRate > 0 ? foreignAmount / activeRate : 0;

  function handleCurrencyChange(code: string) {
    setSelectedCurrency(code);
    setAmountInput('');
    setDebouncedAmount(0);
    setDenomQtys([]);
  }

  function handleModeChange(mode: ClientMode) {
    setClientMode(mode);
    setDenomQtys([]);
  }

  const canConfirm = selectedCurrency !== null && foreignAmount > 0 && selectedRate !== null;

  async function handleSubmitTransaction() {
    if (!selectedCurrency || !selectedRate || foreignAmount === 0) return;

    const denomsMap: Record<string, number> = {};
    denomQtys.filter((q) => q.quantity > 0).forEach((q) => {
      denomsMap[String(q.value)] = q.quantity;
    });

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type: bureauMode,
        currency: selectedCurrency,
        amount_foreign: foreignAmount,
        denominations: denomsMap,
      };
      if (customerEmail.trim()) body.customer_email = customerEmail.trim();

      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }
      const raw = await res.json();
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
    setCustomerEmail('');
  }

  const popularChips = POPULAR_CURRENCIES.filter(code => rates.some(r => r.code === code));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{t('header.title')}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{t('header.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Error banner */}
        {ratesError && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {t('error.ratesFailed', { error: ratesError })}
          </div>
        )}

        {/* Buy / Sell toggle — full-width side-by-side cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange('buy')}
            className={`flex flex-col items-center gap-2 px-4 py-5 rounded-2xl border-2 transition-all font-medium text-sm ${
              clientMode === 'buy'
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Banknote className="w-6 h-6" />
            <span className="font-semibold">{t('mode.buy')}</span>
            <span className="text-xs opacity-70">{t('mode.buyDesc')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('sell')}
            className={`flex flex-col items-center gap-2 px-4 py-5 rounded-2xl border-2 transition-all font-medium text-sm ${
              clientMode === 'sell'
                ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Building2 className="w-6 h-6" />
            <span className="font-semibold">{t('mode.sell')}</span>
            <span className="text-xs opacity-70">{t('mode.sellDesc')}</span>
          </button>
        </div>

        {/* Currency selector + quick-chips */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('currency.selectLabel')}
          </h2>
          {ratesLoading ? (
            <div className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : (
            <CurrencySelector
              rates={rates}
              value={selectedCurrency}
              onChange={handleCurrencyChange}
              placeholder={t('currency.searchPlaceholder')}
            />
          )}

          {/* Popular quick-select chips — shown when nothing is selected yet */}
          {!selectedCurrency && !ratesLoading && popularChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{t('currency.popular')}</span>
              {popularChips.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleCurrencyChange(code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all"
                >
                  <CurrencyFlag code={code} />
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Two-column section: Rate | Amount + Denominations */}
        {selectedCurrency && selectedRate && (
          <div
            style={{ animation: 'slideUp 0.2s ease-out' }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start"
          >
            {/* Left column: Rate display */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {t('rate.label')}
              </h2>
              <RateDisplay rate={selectedRate} secondsLeft={secondsLeft} mode={bureauMode} />
            </div>

            {/* Right column: Amount input + Denomination picker */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
              {/* Manual amount input */}
              <div>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {t('amount.label', { currency: selectedCurrency })}
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
                      setDenomQtys([]);
                    }}
                    placeholder="0.00"
                    className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg font-semibold outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-colors"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  {t('amount.orUsePicker')}
                </p>
              </div>

              {/* Denomination picker */}
              {denomLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    if (qs.length > 0) setAmountInput('');
                  }}
                  mode={bureauMode}
                  currencyCode={selectedCurrency}
                />
              ) : null}
            </div>
          </div>
        )}

        {/* CAD total + Confirm — full width */}
        {selectedCurrency && selectedRate && (
          <div
            style={{ animation: 'slideUp 0.25s ease-out' }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {clientMode === 'buy' ? t('total.willPay') : t('total.willReceive')}
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
              <div className={`p-3 rounded-xl ${clientMode === 'buy' ? 'bg-blue-50 dark:bg-blue-950 text-blue-500' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-500'}`}>
                {clientMode === 'buy'
                  ? <Banknote className="w-8 h-8" />
                  : <Building2 className="w-8 h-8" />
                }
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEmailPromptOpen(true)}
              disabled={!canConfirm}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {canConfirm ? t('button.review') : t('button.enterAmount')}
            </button>
          </div>
        )}
      </main>

      {/* Email prompt modal */}
      {emailPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/50 dark:bg-black/70">
          <div
            style={{ animation: 'slideUp 0.2s ease-out' }}
            className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('email.title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {t('email.subtitle')}
            </p>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder={t('email.placeholder')}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-colors mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setCustomerEmail(''); setEmailPromptOpen(false); setConfirmOpen(true); }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                {t('email.skip')}
              </button>
              <button
                type="button"
                onClick={() => { setEmailPromptOpen(false); setConfirmOpen(true); }}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold transition-colors text-sm"
              >
                {t('email.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmOpen && selectedRate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/50 dark:bg-black/70">
          <div
            style={{ animation: 'slideUp 0.2s ease-out' }}
            className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('confirm.title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t('confirm.subtitle')}</p>

            <div className="space-y-3 mb-6">
              <ConfirmRow label={t('confirm.transaction')} value={clientMode === 'buy' ? t('confirm.buyingLabel') : t('confirm.sellingLabel')} />
              <ConfirmRow label={t('confirm.currency')} value={<span className="flex items-center gap-1.5"><CurrencyFlag code={selectedRate.code} /> {selectedRate.code} — {selectedRate.name}</span>} />
              <ConfirmRow label={t('confirm.foreignAmount')} value={`${foreignAmount.toLocaleString()} ${selectedCurrency}`} />
              <ConfirmRow label={t('confirm.exchangeRate')} value={t('confirm.rateFormula', { rate: activeRate.toFixed(4), currency: selectedCurrency })} />
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <ConfirmRow
                  label={clientMode === 'buy' ? t('confirm.totalPay') : t('confirm.totalReceive')}
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
                {t('confirm.cancel')}
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
                    {t('confirm.processing')}
                  </>
                ) : (
                  t('confirm.submit')
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
