import fetch from 'node-fetch';
import prisma from '../db/client';

const FRANKFURTER_BASE = 'https://api.frankfurter.app';
const RATE_TTL_MS = (parseInt(process.env.RATE_TTL_SECONDS ?? '60', 10)) * 1000;

// Bureau margin — configurable via env
const BUY_MARGIN  = parseFloat(process.env.BUY_MARGIN  ?? '0.985'); // bureau buys foreign at 98.5% of market
const SELL_MARGIN = parseFloat(process.env.SELL_MARGIN ?? '1.015'); // bureau sells foreign at 101.5% of market

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CNY',
  'MAD', 'SAR', 'AED', 'QAR', 'KWD',
  'TRY', 'MXN', 'INR', 'BRL', 'AUD', 'HKD', 'SGD',
  'NZD', 'DOP', 'XCD', 'CUP',
];

// Currencies not available on Frankfurter — approximate rates vs CAD.
// These are updated semi-manually; the fallback keeps the app functional
// even when the primary API doesn't cover a currency.
const FALLBACK_RATES_VS_CAD: Record<string, number> = {
  MAD:  10.20, // Moroccan Dirham
  SAR:   2.81, // Saudi Riyal
  AED:   2.74, // UAE Dirham
  QAR:   2.73, // Qatari Riyal
  KWD:   0.228, // Kuwaiti Dinar
  DOP:  59.00, // Dominican Peso
  XCD:   2.02, // Eastern Caribbean Dollar
  CUP:  33.00, // Cuban Peso (official rate)
};

interface FrankfurterResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
}

/**
 * Fetch live market rates from Frankfurter. Returns rates quoted as "how many
 * units of foreign currency per 1 CAD" — i.e. CAD is the base.
 */
async function fetchLiveRates(): Promise<Record<string, number>> {
  const symbols = SUPPORTED_CURRENCIES.join(',');
  const url = `${FRANKFURTER_BASE}/latest?base=CAD&symbols=${symbols}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Frankfurter API error: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as FrankfurterResponse;
  return data.rates;
}

/**
 * Get all rates from cache if fresh, otherwise re-fetch and store.
 * Returns an array suitable for the /api/rates response.
 */
export async function getRates() {
  const cutoff = new Date(Date.now() - RATE_TTL_MS);

  // Check if we have any fresh rates
  const fresh = await prisma.exchangeRate.findFirst({
    where: { fetchedAt: { gte: cutoff } },
    orderBy: { fetchedAt: 'desc' },
  });

  if (fresh) {
    // Cache hit — return all latest rates per currency
    const rates = await prisma.$queryRaw<
      { currency_code: string; buy_rate: number; sell_rate: number; market_rate: number; fetched_at: Date }[]
    >`
      SELECT DISTINCT ON ("currencyCode")
        "currencyCode" AS currency_code,
        "buyRate"      AS buy_rate,
        "sellRate"     AS sell_rate,
        "marketRate"   AS market_rate,
        "fetchedAt"    AS fetched_at
      FROM "ExchangeRate"
      ORDER BY "currencyCode", "fetchedAt" DESC
    `;
    return enrichWithCurrency(rates);
  }

  // Cache miss — fetch fresh
  return refreshRates();
}

/**
 * Force-refresh rates from the external API and persist to DB.
 */
export async function refreshRates() {
  let marketRates: Record<string, number>;

  try {
    marketRates = await fetchLiveRates();
  } catch (err) {
    console.error('Rate fetch failed, falling back to last known rates:', err);
    // Fallback: return whatever is in the DB (even stale)
    const stale = await prisma.$queryRaw<
      { currency_code: string; buy_rate: number; sell_rate: number; market_rate: number; fetched_at: Date }[]
    >`
      SELECT DISTINCT ON ("currencyCode")
        "currencyCode" AS currency_code,
        "buyRate"      AS buy_rate,
        "sellRate"     AS sell_rate,
        "marketRate"   AS market_rate,
        "fetchedAt"    AS fetched_at
      FROM "ExchangeRate"
      ORDER BY "currencyCode", "fetchedAt" DESC
    `;
    if (stale.length > 0) return enrichWithCurrency(stale);
    throw new Error('No rates available — external API unreachable and no cached rates found');
  }

  const now = new Date();
  // Merge live rates with fallback rates for unsupported currencies
  const allRates: Record<string, number> = { ...FALLBACK_RATES_VS_CAD, ...marketRates };

  const inserts = Object.entries(allRates)
    .filter(([code]) => SUPPORTED_CURRENCIES.includes(code))
    .map(([code, market]) =>
      prisma.exchangeRate.create({
        data: {
          currencyCode: code,
          marketRate:   market,
          buyRate:      market * BUY_MARGIN,
          sellRate:     market * SELL_MARGIN,
          fetchedAt:    now,
        },
      })
    );

  await prisma.$transaction(inserts);

  // Clean up rates older than 24 h to prevent unbounded growth
  await prisma.exchangeRate.deleteMany({
    where: { fetchedAt: { lt: new Date(Date.now() - 86_400_000) } },
  });

  const rows = await prisma.$queryRaw<
    { currency_code: string; buy_rate: number; sell_rate: number; market_rate: number; fetched_at: Date }[]
  >`
    SELECT DISTINCT ON ("currencyCode")
      "currencyCode" AS currency_code,
      "buyRate"      AS buy_rate,
      "sellRate"     AS sell_rate,
      "marketRate"   AS market_rate,
      "fetchedAt"    AS fetched_at
    FROM "ExchangeRate"
    ORDER BY "currencyCode", "fetchedAt" DESC
  `;
  return enrichWithCurrency(rows);
}

/**
 * Get the current rate for a specific currency (with cache).
 */
export async function getRateForCurrency(code: string): Promise<{
  buyRate: number;
  sellRate: number;
  marketRate: number;
} | null> {
  const cutoff = new Date(Date.now() - RATE_TTL_MS);

  const rate = await prisma.exchangeRate.findFirst({
    where: { currencyCode: code, fetchedAt: { gte: cutoff } },
    orderBy: { fetchedAt: 'desc' },
  });

  if (rate) {
    return { buyRate: rate.buyRate, sellRate: rate.sellRate, marketRate: rate.marketRate };
  }

  // Refresh all rates and return the one we need
  const all = await refreshRates();
  const found = all.find((r) => r.currency_code === code);
  if (!found) return null;
  return { buyRate: found.buy_rate, sellRate: found.sell_rate, marketRate: found.market_rate };
}

async function enrichWithCurrency(
  rows: { currency_code: string; buy_rate: number; sell_rate: number; market_rate: number; fetched_at: Date }[]
) {
  const currencies = await prisma.currency.findMany({ where: { isActive: true } });
  const currMap = Object.fromEntries(currencies.map((c) => [c.code, c]));

  return rows
    .filter((r) => currMap[r.currency_code]) // skip inactive / removed currencies
    .map((r) => ({
      currency_code: r.currency_code,
      name:          currMap[r.currency_code].name,
      flag_emoji:    currMap[r.currency_code].flagEmoji,
      buy_rate:      r.buy_rate,
      sell_rate:     r.sell_rate,
      market_rate:   r.market_rate,
      last_updated:  r.fetched_at,
    }));
}
