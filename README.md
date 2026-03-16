# Bureau Exchange

[![CI](https://github.com/skynet0x00/currency-bureau/actions/workflows/ci.yml/badge.svg)](https://github.com/skynet0x00/currency-bureau/actions/workflows/ci.yml)
[![CD](https://github.com/skynet0x00/currency-bureau/actions/workflows/cd.yml/badge.svg)](https://github.com/skynet0x00/currency-bureau/actions/workflows/cd.yml)
[![Docker](https://img.shields.io/badge/ghcr.io-skynet0x00-blue?logo=docker&logoColor=white)](https://github.com/skynet0x00?tab=packages&repo_name=currency-bureau)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-025E8C?logo=dependabot&logoColor=white)](https://github.com/skynet0x00/currency-bureau/network/updates)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade currency exchange bureau web application — live rates, till management, transaction engine, and a real-time admin dashboard.


---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              Browser                                  │
│                                                                       │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐   │
│  │  client-app  (port 5173)   │   │   admin-app  (port 5174)     │   │
│  │  Public kiosk UI           │   │   Operator dashboard         │   │
│  │  · Currency selector       │   │   · Live transaction feed    │   │
│  │  · Denomination picker     │   │   · Till inline editing      │   │
│  │  · CAD preview             │   │   · Rate monitor             │   │
│  │  · Transaction receipt     │   │   · Transaction history+CSV  │   │
│  │                            │   │   · Settings (margins/TTL)   │   │
│  └────────────┬───────────────┘   └──────────────┬───────────────┘   │
│               │  React + Vite + Tailwind CSS v4   │                   │
└───────────────┼──────────────────────────────────┼───────────────────┘
                │         HTTP/JSON + WebSocket      │
                ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Express API  (port 3001)                           │
│                                                                       │
│  GET  /api/rates                 ← live rates, cached 60 s           │
│  POST /api/rates/refresh         ← force-refresh from Frankfurter    │
│  GET  /api/currencies            ← supported currencies + flags      │
│  GET  /api/currencies/:code/denominations                            │
│  GET  /api/till                  ← inventory snapshot + summary      │
│  PUT  /api/till/restock          ← set denomination quantities       │
│  GET  /api/transaction           ← history (up to 500)              │
│  POST /api/transaction           ← process buy / sell               │
│  POST /api/auth/login            ← admin login                       │
│  GET  /api/config                ← bureau settings                   │
│  PUT  /api/config                ← update settings                   │
│  GET  /api/docs                  ← Swagger UI                        │
│                                                                       │
│  WebSocket events (socket.io):                                        │
│    → transaction:new             ← broadcast on every transaction    │
│    → rates:updated               ← broadcast on rate refresh         │
│    → till:updated                ← broadcast on till change          │
│    ← admin:restock               ← admin sends to trigger restock    │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  Prisma ORM
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 17  (port 5432)                          │
│                                                                       │
│  currencies      exchange_rates       till_inventory   transactions   │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
         https://api.frankfurter.app  (no API key needed)
         13 / 20 currencies live — 7 fallback hardcoded rates
```

---

## Quick Start — Local Development

**Prerequisites:** Node.js ≥ 18, PostgreSQL 17

### 1 — PostgreSQL setup (first time only)

```bash
brew install postgresql@17
brew services start postgresql@17

psql -U $(whoami) postgres -c "CREATE DATABASE currency_bureau;"
psql -U $(whoami) postgres -c "CREATE USER bureau_user WITH PASSWORD 'bureau_pass';"
psql -U $(whoami) postgres -c "GRANT ALL PRIVILEGES ON DATABASE currency_bureau TO bureau_user;"
psql -U $(whoami) -d currency_bureau -c "GRANT ALL ON SCHEMA public TO bureau_user;"
psql -U $(whoami) postgres -c "ALTER USER bureau_user CREATEDB;"
```

### 2 — Backend

```bash
cd backend
cp ../.env.example .env      # edit DATABASE_URL if needed
npm install
npx prisma migrate deploy
npx ts-node prisma/seed.ts
npm run dev                  # → http://localhost:3001
```

### 3 — Client app (new terminal)

```bash
cd client-app
npm install
npm run dev                  # → http://localhost:5173
```

### 4 — Admin app (new terminal)

```bash
cd admin-app
npm install
npm run dev                  # → http://localhost:5174
```

Then open:

| URL | Description |
|---|---|
| http://localhost:5173 | Customer kiosk |
| http://localhost:5174 | Admin dashboard (login: `admin` / `admin123`) |
| http://localhost:3001/api/docs | Swagger UI |

---

## Quick Start — Docker

```bash
git clone https://github.com/skynet0x00/currency-bureau.git
cd currency-bureau
cp .env.example .env
docker-compose up --build
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://bureau_user:bureau_pass@localhost:5432/currency_bureau` | PostgreSQL connection string |
| `PORT` | `3001` | Backend port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `CORS_ORIGIN` | `http://localhost:5173` | Client app origin |
| `ADMIN_ORIGIN` | `http://localhost:5174` | Admin app origin |
| `ADMIN_USER` | `admin` | Admin login username |
| `ADMIN_PASS` | `admin123` | Admin login password |
| `RATE_TTL_SECONDS` | `60` | Rate cache duration in seconds |
| `BUY_MARGIN` | `0.985` | Multiplier on market rate when bureau buys foreign |
| `SELL_MARGIN` | `1.015` | Multiplier on market rate when bureau sells foreign |

---

## Rate & Margin System

1. **Live fetch** — every 60 s the backend calls `https://api.frankfurter.app/latest?base=CAD` to get market rates quoted as *units of foreign per 1 CAD*.

2. **Fallback rates** — Frankfurter covers 13 of the 20 bureau currencies. MAD, TND, DZD, SAR, AED, QAR, and KWD use hardcoded approximate rates in `rateService.ts`.

3. **Margins:**
   ```
   buyRate  = marketRate × BUY_MARGIN   (0.985 → bureau pays 1.5% less than market)
   sellRate = marketRate × SELL_MARGIN  (1.015 → bureau charges 1.5% more than market)
   ```

4. **CAD conversion:**
   ```
   amountCAD = amountForeign / rateApplied
   ```
   - Client *sells* to bureau (`type=buy`)  → uses `buyRate`
   - Client *buys* from bureau (`type=sell`) → uses `sellRate`

5. **Cache** — rates are persisted to `exchange_rates` in Postgres. Rows older than 24 h are pruned automatically.

---

## API Reference

Full interactive docs at **`http://localhost:3001/api/docs`**.

| Method | Path | Description |
|---|---|---|
| GET | `/api/rates` | All live rates (cached) |
| POST | `/api/rates/refresh` | Force-refresh from Frankfurter |
| GET | `/api/currencies` | Supported currency list with flags |
| GET | `/api/currencies/:code/denominations` | Denomination inventory for a currency |
| GET | `/api/till` | Full till — summary + flat inventory |
| PUT | `/api/till/restock` | Set denomination quantities |
| GET | `/api/transaction` | Transaction history |
| POST | `/api/transaction` | Process a buy or sell |
| POST | `/api/auth/login` | Admin login |
| GET | `/api/config` | Bureau settings |
| PUT | `/api/config` | Update bureau settings |

### POST /api/transaction

```json
// Request
{
  "type": "sell",
  "currency": "USD",
  "amount_foreign": 500,
  "denominations": { "100": 4, "50": 2 }
}

// Response
{
  "transaction_id": "uuid",
  "type": "sell",
  "currency": "USD",
  "currency_name": "US Dollar",
  "flag_emoji": "🇺🇸",
  "amount_foreign": 500,
  "amount_cad": 693.25,
  "rate": 0.7214,
  "denominations_given": { "100": 4, "50": 2 },
  "denominations_received": {},
  "timestamp": "2026-03-15T00:00:00.000Z"
}
```

`denominations` is optional — omit or send `{}` to skip denomination tracking.

---

## Real-Time Events (socket.io)

| Event | Direction | Payload |
|---|---|---|
| `transaction:new` | server → clients | full transaction object |
| `rates:updated` | server → clients | `{ base, rates[] }` |
| `till:updated` | server → clients | `{ currency, timestamp }` |
| `admin:restock` | admin → server | `{ currency, denominations: { "100": 5 } }` |

---

## Project Structure

```
currency-bureau/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # DB schema (5 models)
│   │   ├── seed.ts                # Seeds 20 currencies + till inventory
│   │   └── migrations/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── config.ts
│   │   │   ├── currencies.ts
│   │   │   ├── rates.ts
│   │   │   ├── till.ts
│   │   │   └── transactions.ts
│   │   ├── services/
│   │   │   ├── rateService.ts     # Frankfurter fetch + TTL cache
│   │   │   └── tillService.ts     # Atomic deduct / add / restock
│   │   ├── socket.ts              # socket.io singleton + emitters
│   │   ├── app.ts
│   │   ├── index.ts
│   │   └── swagger.ts
│   └── Dockerfile
│
├── client-app/                    # Public kiosk (port 5173)
│   ├── src/
│   │   ├── components/            # CurrencySelector, DenominationPicker,
│   │   │                          # RateDisplay, Receipt, Toast, ThemeToggle
│   │   ├── hooks/                 # useRates, useDenominations
│   │   ├── pages/                 # ExchangePage
│   │   └── types.ts
│   ├── Dockerfile
│   └── nginx.conf
│
├── admin-app/                     # Operator dashboard (port 5174)
│   ├── src/
│   │   ├── components/            # Layout, Sidebar, Toast
│   │   ├── hooks/                 # useSocket, useAuth
│   │   ├── pages/                 # Dashboard, Till, Rates,
│   │   │                          # Transactions, Settings, Login
│   │   └── types.ts
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Supported Currencies

| Code | Currency | Live Rate |
|---|---|---|
| USD | US Dollar | ✅ Frankfurter |
| EUR | Euro | ✅ Frankfurter |
| GBP | British Pound | ✅ Frankfurter |
| CHF | Swiss Franc | ✅ Frankfurter |
| JPY | Japanese Yen | ✅ Frankfurter |
| CNY | Chinese Yuan | ✅ Frankfurter |
| TRY | Turkish Lira | ✅ Frankfurter |
| MXN | Mexican Peso | ✅ Frankfurter |
| INR | Indian Rupee | ✅ Frankfurter |
| BRL | Brazilian Real | ✅ Frankfurter |
| AUD | Australian Dollar | ✅ Frankfurter |
| HKD | Hong Kong Dollar | ✅ Frankfurter |
| SGD | Singapore Dollar | ✅ Frankfurter |
| MAD | Moroccan Dirham | ⚡ Fallback |
| TND | Tunisian Dinar | ⚡ Fallback |
| DZD | Algerian Dinar | ⚡ Fallback |
| SAR | Saudi Riyal | ⚡ Fallback |
| AED | UAE Dirham | ⚡ Fallback |
| QAR | Qatari Riyal | ⚡ Fallback |
| KWD | Kuwaiti Dinar | ⚡ Fallback |
