import { useState, useEffect, useCallback } from 'react';
import type { Rate } from '../types';
import { useSocket } from './useSocket';

const POLL_INTERVAL = 30_000;

// Transform snake_case API response to our camelCase Rate type
function toRate(r: any): Rate {
  return {
    code:       r.currency_code,
    name:       r.name,
    flag:       r.flag_emoji,
    buyRate:    r.buy_rate,
    sellRate:   r.sell_rate,
    marketRate: r.market_rate,
  };
}

export function useRates() {
  const [rates, setRates]         = useState<Rate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRates((data.rates ?? []).map(toRate));
      setLastFetch(new Date());
      setError(null);
      setSecondsLeft(30);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  }, []);

  // Socket: real-time rate updates → transform and update state
  const handleSocketRates = useCallback((data: any) => {
    if (data?.rates) {
      setRates(data.rates.map(toRate));
      setLastFetch(new Date());
      setSecondsLeft(30);
    }
  }, []);

  useSocket(handleSocketRates);

  useEffect(() => {
    fetchRates();
    const pollId    = setInterval(fetchRates, POLL_INTERVAL);
    const countId   = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => { clearInterval(pollId); clearInterval(countId); };
  }, [fetchRates]);

  return { rates, loading, error, lastFetch, secondsLeft };
}
