import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Currency Exchange Bureau API',
      version: '1.0.0',
      description: `
REST API for a full-featured currency exchange bureau.

**Base currency:** CAD (Canadian Dollar)

**Rate margins:**
- Buy rate (client sells to bureau) = market rate × 0.985
- Sell rate (bureau sells to client) = market rate × 1.015

**Rate caching:** Rates are cached in PostgreSQL for 60 seconds. The external
source is [frankfurter.app](https://www.frankfurter.app/).
      `,
      contact: { name: 'Bureau Admin', email: 'admin@bureau.local' },
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local development' },
    ],
    components: {
      schemas: {
        Rate: {
          type: 'object',
          properties: {
            currency_code: { type: 'string', example: 'USD' },
            name:          { type: 'string', example: 'US Dollar' },
            flag_emoji:    { type: 'string', example: '🇺🇸' },
            buy_rate:      { type: 'number', example: 1.3290, description: 'Foreign units per 1 CAD (bureau buys)' },
            sell_rate:     { type: 'number', example: 1.3694, description: 'Foreign units per 1 CAD (bureau sells)' },
            market_rate:   { type: 'number', example: 1.3491 },
            last_updated:  { type: 'string', format: 'date-time' },
          },
        },
        TransactionRequest: {
          type: 'object',
          required: ['type', 'currency', 'amount_foreign', 'denominations'],
          properties: {
            type: {
              type: 'string',
              enum: ['buy', 'sell'],
              description: 'buy = client sells foreign to bureau; sell = bureau sells foreign to client',
            },
            currency:       { type: 'string', example: 'USD' },
            amount_foreign: { type: 'number', example: 500 },
            denominations: {
              type: 'object',
              additionalProperties: { type: 'integer' },
              example: { '100': 4, '50': 2 },
            },
          },
        },
        TransactionResponse: {
          type: 'object',
          properties: {
            transaction_id:       { type: 'string', format: 'uuid' },
            type:                 { type: 'string', enum: ['buy', 'sell'] },
            currency:             { type: 'string' },
            amount_foreign:       { type: 'number' },
            amount_cad:           { type: 'number' },
            rate:                 { type: 'number' },
            denominations_given:  { type: 'object', additionalProperties: { type: 'integer' } },
            denominations_received: { type: 'object', additionalProperties: { type: 'integer' } },
            timestamp:            { type: 'string', format: 'date-time' },
          },
        },
        RestockRequest: {
          type: 'object',
          required: ['currency', 'denominations'],
          properties: {
            currency: { type: 'string', example: 'USD' },
            denominations: {
              type: 'object',
              additionalProperties: { type: 'integer' },
              example: { '100': 50, '50': 80 },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Rates',        description: 'Exchange rate endpoints' },
      { name: 'Till',         description: 'Till inventory management' },
      { name: 'Transactions', description: 'Transaction processing' },
      { name: 'Currencies',   description: 'Currency metadata' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
