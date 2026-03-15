export interface Rate {
  code: string;
  name: string;
  flag: string;
  buyRate: number;
  sellRate: number;
  marketRate: number;
}

export interface RatesResponse {
  base: string;
  rates: Rate[];
  updatedAt: string;
}

export interface Currency {
  code: string;
  name: string;
  flag: string;
}

export interface DenominationInfo {
  value: number;
  label: string;
  availableInTill: number;
}

export interface CurrencyDenominations {
  code: string;
  name: string;
  denominations: DenominationInfo[];
}

export interface TransactionRequest {
  type: 'buy' | 'sell';
  currencyCode: string;
  denominations: { value: number; quantity: number }[];
  foreignAmount: number;
  cadAmount: number;
  rate: number;
}

export interface TransactionResponse {
  transactionId: string;
  type: 'buy' | 'sell';
  currencyCode: string;
  foreignAmount: number;
  cadAmount: number;
  rate: number;
  denominations: { value: number; quantity: number }[];
  createdAt: string;
}
