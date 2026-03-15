/** Maps 3-letter currency codes → ISO 3166-1 alpha-2 country codes for flagcdn.com */
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: 'us', EUR: 'eu', GBP: 'gb', CHF: 'ch', JPY: 'jp',
  CNY: 'cn', TRY: 'tr', MXN: 'mx', INR: 'in', BRL: 'br',
  AUD: 'au', HKD: 'hk', SGD: 'sg', MAD: 'ma', TND: 'tn',
  DZD: 'dz', SAR: 'sa', AED: 'ae', QAR: 'qa', KWD: 'kw',
};

interface CurrencyFlagProps {
  /** ISO 4217 currency code, e.g. "USD" */
  code: string;
  /** sm = 20×15 (tables/lists), lg = 24×18 (selected / prominent) */
  size?: 'sm' | 'lg';
}

export function CurrencyFlag({ code, size = 'sm' }: CurrencyFlagProps) {
  const country = CURRENCY_TO_COUNTRY[code.toUpperCase()];
  if (!country) return null;
  const [w, h] = size === 'lg' ? [24, 18] : [20, 15];
  return (
    <img
      src={`https://flagcdn.com/w40/${country}.png`}
      alt={code}
      width={w}
      height={h}
      className="inline-block object-cover rounded-[2px] shrink-0"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
