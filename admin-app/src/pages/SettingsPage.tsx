import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { BureauConfig } from '../types';
import type {ToastType} from '../components/Toast';

interface OutletCtx {
  push: (message: string, type?: ToastType) => void;
}

interface SettingsPageProps {
  push?: (message: string, type?: ToastType) => void;
}

export function SettingsPage({ push: pushProp }: SettingsPageProps) {
  let push: (message: string, type?: ToastType) => void;
  try {
    const ctx = useOutletContext<OutletCtx>();
    push = pushProp ?? ctx.push;
  } catch {
    push = pushProp ?? (() => {});
  }

  const [config, setConfig] = useState<BureauConfig>({
    buy_margin: 0.985,
    sell_margin: 1.015,
    rate_ttl_seconds: 300,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('bureau_admin_token');

  useEffect(() => {
    async function fetchConfig() {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/config', { headers });
        if (res.ok) {
          const data: BureauConfig = await res.json();
          setConfig(data);
        } else {
          push('Failed to load configuration', 'error');
        }
      } catch {
        push('Network error loading config', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [push, token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });
      if (res.ok) {
        push('Configuration saved successfully', 'success');
      } else {
        push('Failed to save configuration', 'error');
      }
    } catch {
      push('Network error saving config', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof BureauConfig, value: string) {
    setConfig(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Margin settings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Exchange Rate Margins</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Margins are applied to the market rate to calculate customer buy/sell rates.
            </p>
          </div>
          <div className="p-6 space-y-5">
            {/* Buy margin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Buy Margin
              </label>
              <input
                type="number"
                step="0.001"
                min="0.5"
                max="1.0"
                value={config.buy_margin}
                onChange={e => handleChange('buy_margin', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition"
              />
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <span className="font-semibold">Buy margin</span> — when the bureau <em>buys</em> foreign currency from the customer.
                  A value of <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">0.985</code> means the customer receives
                  1.5% less than the market rate (e.g. market = 1.3500 CAD, buy rate = 1.3298 CAD).
                </p>
              </div>
            </div>

            {/* Sell margin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Sell Margin
              </label>
              <input
                type="number"
                step="0.001"
                min="1.0"
                max="1.5"
                value={config.sell_margin}
                onChange={e => handleChange('sell_margin', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition"
              />
              <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  <span className="font-semibold">Sell margin</span> — when the bureau <em>sells</em> foreign currency to the customer.
                  A value of <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">1.015</code> means the customer pays
                  1.5% more than the market rate (e.g. market = 1.3500 CAD, sell rate = 1.3703 CAD).
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Live preview (assuming market rate = 1.3500)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Buy rate</p>
                  <p className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                    {(1.35 * config.buy_margin).toFixed(4)} CAD
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sell rate</p>
                  <p className="font-mono font-semibold text-orange-700 dark:text-orange-400">
                    {(1.35 * config.sell_margin).toFixed(4)} CAD
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rate TTL */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Rate Cache</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How long fetched rates are cached before being refreshed from the market API.
            </p>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Rate TTL (seconds)
            </label>
            <input
              type="number"
              step="30"
              min="30"
              max="86400"
              value={config.rate_ttl_seconds}
              onChange={e => handleChange('rate_ttl_seconds', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Current: rates are cached for <span className="font-semibold text-gray-700 dark:text-gray-300">{config.rate_ttl_seconds}s</span>
              {config.rate_ttl_seconds >= 60 && ` (${Math.round(config.rate_ttl_seconds / 60)} min)`}.
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
