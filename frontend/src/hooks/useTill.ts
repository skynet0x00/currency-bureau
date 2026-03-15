import { useState, useEffect, useCallback } from 'react';
import type { CurrencyDenominations, TillResponse } from '../types';

export function useDenominations(currencyCode: string | null) {
  const [data, setData]       = useState<CurrencyDenominations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetch_ = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/currencies/${code}/denominations`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CurrencyDenominations = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currencyCode) fetch_(currencyCode);
    else setData(null);
  }, [currencyCode, fetch_]);

  return { data, loading, error };
}

export function useTillInventory(refreshTrigger: number = 0) {
  const [data, setData]       = useState<TillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchTill = useCallback(async () => {
    try {
      const res = await fetch('/api/till');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TillResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTill();
  }, [fetchTill, refreshTrigger]);

  return { data, loading, error, refetch: fetchTill };
}

export function useTransactions(refreshTrigger: number = 0) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);

  const fetchTx = useCallback(async () => {
    try {
      const res = await fetch('/api/transaction?limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTransactions(await res.json());
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTx();
  }, [fetchTx, refreshTrigger]);

  return { transactions, loading, refetch: fetchTx };
}
