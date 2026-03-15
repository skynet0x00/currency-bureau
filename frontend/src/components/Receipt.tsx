import type { TransactionResponse } from '../types';

interface Props {
  tx:       TransactionResponse;
  currency: { name: string; flag_emoji: string } | null;
  onClose:  () => void;
}

export function Receipt({ tx, currency, onClose }: Props) {
  const isSell = tx.type === 'sell';
  const denoms = isSell ? tx.denominations_given : tx.denominations_received;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className={`rounded-t-2xl p-6 text-white ${isSell ? 'bg-emerald-600' : 'bg-blue-600'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-80 uppercase tracking-widest mb-1">
                {isSell ? 'Currency Purchase' : 'Currency Exchange'}
              </div>
              <div className="text-2xl font-bold">Transaction Receipt</div>
            </div>
            <div className="text-4xl">{currency?.flag_emoji ?? '💱'}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <Row label="Transaction ID" value={tx.transaction_id.slice(0, 8) + '…'} mono />
          <Row label="Type"           value={isSell ? 'Buy Foreign (You receive)' : 'Sell Foreign (You hand over)'} />
          <Row label="Currency"       value={`${currency?.flag_emoji ?? ''} ${tx.currency} — ${currency?.name ?? ''}`} />
          <Row
            label={isSell ? 'Amount Received' : 'Amount Sold'}
            value={`${tx.amount_foreign.toLocaleString()} ${tx.currency}`}
            large
          />
          <Row
            label={isSell ? 'You Pay (CAD)' : 'You Receive (CAD)'}
            value={`CA$${tx.amount_cad.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            large accent
          />
          <Row label="Rate Applied" value={`${tx.rate.toFixed(4)} ${tx.currency}/CAD`} mono />

          {/* Denomination breakdown */}
          {Object.keys(denoms).length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Denomination Breakdown
              </div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(denoms).map(([d, q]) => (
                  <div key={d} className="flex justify-between text-sm py-1 border-b border-dashed border-gray-100 dark:border-gray-800">
                    <span className="font-mono text-gray-600 dark:text-gray-400">{tx.currency} {d}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">× {q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 text-right">
            {new Date(tx.timestamp).toLocaleString()}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label, value, mono = false, large = false, accent = false,
}: {
  label: string; value: string; mono?: boolean; large?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span
        className={`text-right break-all ${mono ? 'font-mono text-xs' : ''} ${
          large ? 'text-lg font-bold' : 'text-sm font-medium'
        } ${accent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}
      >
        {value}
      </span>
    </div>
  );
}
