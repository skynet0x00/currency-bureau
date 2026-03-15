import { useState, useEffect, useCallback } from 'react';
import type { Rate, RatesResponse } from '../types';

const POLL_INTERVAL = 30_000; // 30 seconds

export function useRates() {
  const [rates, setRates]       = useState<Rate[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RatesResponse = await res.json();
      setRates(data.rates);
      setLastFetch(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchRates]);

  return { rates, loading, error, lastFetch, refetch: fetchRates };
}

export function useRateForCurrency(rates: Rate[], code: string | null): Rate | null {
  if (!code) return null;
  return rates.find((r) => r.currency_code === code) ?? null;
}
