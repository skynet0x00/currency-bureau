export interface Rate {
  currency_code: string;
  name:          string;
  flag_emoji:    string;
  buy_rate:      number;
  sell_rate:     number;
  market_rate:   number;
  last_updated:  string;
}

export interface RatesResponse {
  base:  string;
  rates: Rate[];
}

export interface Currency {
  code:       string;
  name:       string;
  flag_emoji: string;
  is_active:  boolean;
}

export interface DenominationInfo {
  denomination: number;
  quantity:     number;
}

export interface CurrencyDenominations {
  currency_code: string;
  denominations: DenominationInfo[];
}

export interface TillInventoryItem {
  currency_code: string;
  denomination:  number;
  quantity:      number;
  updated_at:    string;
}

export interface TillCurrencySummary {
  code:           string;
  name:           string;
  flagEmoji:      string;
  totalFaceValue: number;
  denominations:  DenominationInfo[];
}

export interface TillResponse {
  summary?:   TillCurrencySummary[];
  inventory:  TillInventoryItem[];
}

export interface TransactionRequest {
  type:           'buy' | 'sell';
  currency:       string;
  amount_foreign: number;
  denominations:  Record<string, number>;
}

export interface TransactionResponse {
  transaction_id:        string;
  type:                  'buy' | 'sell';
  currency:              string;
  amount_foreign:        number;
  amount_cad:            number;
  rate:                  number;
  denominations_given:   Record<string, number>;
  denominations_received: Record<string, number>;
  timestamp:             string;
}

export interface TransactionRecord {
  transaction_id: string;
  type:           string;
  currency_code:  string;
  currency_name:  string;
  flag_emoji:     string;
  amount_foreign: number;
  amount_cad:     number;
  rate_used:      number;
  denominations:  Record<string, number>;
  timestamp:      string;
}
