import type { TransactionResponse } from '../types';
import { CurrencyFlag } from './CurrencyFlag';

interface ReceiptProps {
  transaction: TransactionResponse;
  onNewTransaction: () => void;
}

export function Receipt({ transaction, onNewTransaction }: ReceiptProps) {
  const isBuyFromClient = transaction.type === 'buy'; // bureau buys = client sells foreign
  const date = new Date(transaction.createdAt);
  const dateStr = date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 print:bg-white print:p-0">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:max-w-none">

        {/* Print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .receipt-content, .receipt-content * { visibility: visible; }
            .receipt-content { position: fixed; top: 0; left: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div className="receipt-content">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white print:from-gray-800 print:to-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wider">Transaction Receipt</p>
                <h2 className="text-xl font-bold mt-0.5">Bureau Exchange</h2>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                ✓
              </div>
            </div>
          </div>

          {/* Transaction summary */}
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Transaction Confirmed
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">ID: {transaction.transactionId}</p>
            </div>

            {/* Exchange summary box */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 flex items-center gap-4">
              {isBuyFromClient ? (
                <>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">You gave</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-1.5">
                      <CurrencyFlag code={transaction.currencyCode} />
                      {transaction.foreignAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {transaction.currencyCode}
                    </div>
                  </div>
                  <div className="text-gray-300 dark:text-gray-600 text-2xl">→</div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">You received</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${transaction.cadAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">You paid</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      ${transaction.cadAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD
                    </div>
                  </div>
                  <div className="text-gray-300 dark:text-gray-600 text-2xl">→</div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">You received</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                      <CurrencyFlag code={transaction.currencyCode} />
                      {transaction.foreignAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {transaction.currencyCode}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-4 space-y-2.5">
            <DetailRow label="Date" value={dateStr} />
            <DetailRow label="Time" value={timeStr} />
            <DetailRow label="Transaction Type" value={isBuyFromClient ? 'Client Sold Foreign' : 'Client Bought Foreign'} />
            <DetailRow label="Currency" value={`${transaction.currencyCode}`} />
            <DetailRow label="Exchange Rate" value={`1 ${transaction.currencyCode} = ${transaction.rate.toFixed(4)} CAD`} />
          </div>

          {/* Denominations */}
          {transaction.denominations && transaction.denominations.length > 0 && (
            <div className="px-6 pb-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Denominations</p>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                {transaction.denominations.filter((d) => d.quantity > 0).map((d, i) => (
                  <div key={d.value} className={`flex items-center justify-between px-4 py-2 text-sm ${
                    i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <span className="text-gray-600 dark:text-gray-400">{d.value} {transaction.currencyCode} × {d.quantity}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(d.value * d.quantity).toLocaleString()} {transaction.currencyCode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3 no-print">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
              </svg>
              Print
            </button>
            <button
              onClick={onNewTransaction}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              New Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
