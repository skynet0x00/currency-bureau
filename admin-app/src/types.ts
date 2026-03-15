export interface Rate {
  currency_code: string;
  currency_name: string;
  flag: string;
  market_rate: number;
  buy_rate: number;
  sell_rate: number;
  last_fetched: string;
}

export interface Currency {
  code: string;
  name: string;
  flag: string;
}

export interface TillItem {
  currency_code: string;
  denomination: number;
  quantity: number;
}

export interface TillSummary {
  currency_code: string;
  currency_name: string;
  flag: string;
  denominations: { denomination: number; quantity: number }[];
  total_units: number;
  total_cad_value: number;
}

export interface Transaction {
  id: string;
  currency_code: string;
  currency_name: string;
  flag: string;
  transaction_type: 'buy' | 'sell';
  amount_foreign: number;
  amount_cad: number;
  rate: number;
  created_at: string;
}

export interface BureauConfig {
  buy_margin: number;
  sell_margin: number;
  rate_ttl_seconds: number;
}

export interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (user: string, pass: string) => Promise<boolean>;
  logout: () => void;
}
