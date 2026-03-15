import { useState, useEffect } from 'react';
import type { CurrencyDenominations } from '../types';

// API returns { currency_code, denominations: [{ denomination, quantity }] }
// Transform to the CurrencyDenominations shape expected by the UI
function toClientDenominations(raw: any, code: string): CurrencyDenominations {
  return {
    code,
    name: code,
    denominations: (raw.denominations ?? []).map((d: any) => ({
      value: d.denomination,
      label: Number.isInteger(d.denomination)
        ? d.denomination.toLocaleString()
        : d.denomination.toFixed(2),
      availableInTill: d.quantity,
    })),
  };
}

export function useDenominations(currencyCode: string | null) {
  const [data, setData] = useState<CurrencyDenominations | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currencyCode) { setData(null); return; }
    setLoading(true);
    fetch(`/api/currencies/${currencyCode}/denominations`)
      .then((r) => r.json())
      .then((raw) => setData(toClientDenominations(raw, currencyCode)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [currencyCode]);

  return { data, loading };
}
