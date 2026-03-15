import { useState, useEffect } from 'react';
import type { CurrencyDenominations } from '../types';

interface DenominationApiItem {
  denomination: number;
  quantity: number;
}

interface DenominationApiResponse {
  denominations?: DenominationApiItem[];
}

// API returns { currency_code, denominations: [{ denomination, quantity }] }
// Transform to the CurrencyDenominations shape expected by the UI
function toClientDenominations(raw: DenominationApiResponse, code: string): CurrencyDenominations {
  return {
    code,
    name: code,
    denominations: (raw.denominations ?? []).map((d: DenominationApiItem) => ({
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

  useEffect(() => {
    if (!currencyCode) return;
    let cancelled = false;
    fetch(`/api/currencies/${currencyCode}/denominations`)
      .then((r) => r.json())
      .then((raw: DenominationApiResponse) => {
        if (!cancelled) setData(toClientDenominations(raw, currencyCode));
      })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [currencyCode]);

  // loading = true while currencyCode is set but data hasn't arrived for it yet
  const loading = currencyCode !== null && (data === null || data.code !== currencyCode);
  return { data: currencyCode ? data : null, loading };
}
