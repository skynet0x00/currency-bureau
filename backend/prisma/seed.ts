import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',            flagEmoji: '🇺🇸' },
  { code: 'EUR', name: 'Euro',                  flagEmoji: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',         flagEmoji: '🇬🇧' },
  { code: 'CHF', name: 'Swiss Franc',           flagEmoji: '🇨🇭' },
  { code: 'JPY', name: 'Japanese Yen',          flagEmoji: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan',          flagEmoji: '🇨🇳' },
  { code: 'MAD', name: 'Moroccan Dirham',       flagEmoji: '🇲🇦' },
  { code: 'TND', name: 'Tunisian Dinar',        flagEmoji: '🇹🇳' },
  { code: 'DZD', name: 'Algerian Dinar',        flagEmoji: '🇩🇿' },
  { code: 'SAR', name: 'Saudi Riyal',           flagEmoji: '🇸🇦' },
  { code: 'AED', name: 'UAE Dirham',            flagEmoji: '🇦🇪' },
  { code: 'QAR', name: 'Qatari Riyal',          flagEmoji: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar',         flagEmoji: '🇰🇼' },
  { code: 'TRY', name: 'Turkish Lira',          flagEmoji: '🇹🇷' },
  { code: 'MXN', name: 'Mexican Peso',          flagEmoji: '🇲🇽' },
  { code: 'INR', name: 'Indian Rupee',          flagEmoji: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real',        flagEmoji: '🇧🇷' },
  { code: 'AUD', name: 'Australian Dollar',     flagEmoji: '🇦🇺' },
  { code: 'HKD', name: 'Hong Kong Dollar',      flagEmoji: '🇭🇰' },
  { code: 'SGD', name: 'Singapore Dollar',      flagEmoji: '🇸🇬' },
];

// Denominations (bills) per currency — realistic for an exchange bureau
const DENOMINATIONS: Record<string, number[]> = {
  USD: [1, 2, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200, 500],
  GBP: [5, 10, 20, 50],
  CHF: [10, 20, 50, 100, 200, 1000],
  JPY: [1000, 2000, 5000, 10000],
  CNY: [1, 5, 10, 20, 50, 100],
  MAD: [20, 50, 100, 200],
  TND: [5, 10, 20, 50],
  DZD: [200, 500, 1000, 2000],
  SAR: [1, 5, 10, 50, 100, 500],
  AED: [5, 10, 20, 50, 100, 200, 500, 1000],
  QAR: [1, 5, 10, 50, 100, 500],
  KWD: [0.25, 0.5, 1, 5, 10, 20],
  TRY: [5, 10, 20, 50, 100, 200],
  MXN: [20, 50, 100, 200, 500, 1000],
  INR: [10, 20, 50, 100, 200, 500, 2000],
  BRL: [2, 5, 10, 20, 50, 100, 200],
  AUD: [5, 10, 20, 50, 100],
  HKD: [10, 20, 50, 100, 500, 1000],
  SGD: [2, 5, 10, 50, 100, 1000],
};

// Seed quantities — realistic starting stock for a bureau
function seedQty(denom: number): number {
  if (denom >= 500)  return Math.floor(Math.random() * 20) + 10;
  if (denom >= 100)  return Math.floor(Math.random() * 50) + 30;
  if (denom >= 50)   return Math.floor(Math.random() * 80) + 40;
  if (denom >= 10)   return Math.floor(Math.random() * 100) + 50;
  return Math.floor(Math.random() * 150) + 80;
}

async function main() {
  console.log('🌱 Seeding currencies...');
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }

  console.log('🌱 Seeding till inventory...');
  for (const [code, denoms] of Object.entries(DENOMINATIONS)) {
    for (const denom of denoms) {
      await prisma.tillInventory.upsert({
        where: { currencyCode_denomination: { currencyCode: code, denomination: denom } },
        update: { quantity: seedQty(denom) },
        create: { currencyCode: code, denomination: denom, quantity: seedQty(denom) },
      });
    }
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
