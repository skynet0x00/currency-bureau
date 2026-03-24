import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { getRateForCurrency } from '../services/rateService';
import { checkTillSufficiency, deductFromTill, addToTill, DenominationMap } from '../services/tillService';
import { emitTransaction, emitTillUpdated } from '../socket';
import { sendReceiptEmail } from '../services/emailService';

const router = Router();

// In-memory cache for bureau config values that rarely change
let _cachedMaxAmount: number | null = null;
let _cachedMaxAmountAt = 0;
const MAX_AMOUNT_CACHE_MS = 5 * 60 * 1000; // 5 minutes

async function getMaxTransactionAmount(): Promise<number> {
  const now = Date.now();
  if (_cachedMaxAmount !== null && now - _cachedMaxAmountAt < MAX_AMOUNT_CACHE_MS) {
    return _cachedMaxAmount;
  }
  const cfg = await prisma.bureauConfig.findUnique({ where: { key: 'max_transaction_amount' } });
  _cachedMaxAmount = parseFloat(cfg?.value ?? '10000');
  _cachedMaxAmountAt = now;
  return _cachedMaxAmount;
}

interface TransactionBody {
  type: 'buy' | 'sell';
  currency: string;
  amount_foreign: number;
  denominations: DenominationMap;
  customer_email?: string;
}

/**
 * @openapi
 * /api/transaction:
 *   post:
 *     summary: Process a currency exchange transaction
 *     description: |
 *       Process a buy or sell transaction from the bureau's perspective.
 *       - **buy**: Client sells foreign currency to the bureau. Bureau pays out CAD.
 *         The denominations object describes the notes the CLIENT is handing over.
 *       - **sell**: Bureau sells foreign currency to the client. Bureau pays out foreign notes.
 *         The denominations object describes the breakdown the CLIENT wants to receive.
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransactionRequest'
 *           example:
 *             type: sell
 *             currency: USD
 *             amount_foreign: 500
 *             denominations:
 *               "100": 4
 *               "50": 2
 *     responses:
 *       200:
 *         description: Transaction processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionResponse'
 *       400:
 *         description: Validation error or insufficient till inventory
 *       503:
 *         description: Exchange rate unavailable
 */
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Partial<TransactionBody>;

  // --- Validation ---
  if (!body.type || !['buy', 'sell'].includes(body.type)) {
    res.status(400).json({ error: 'type must be "buy" or "sell"' });
    return;
  }
  if (!body.currency || typeof body.currency !== 'string') {
    res.status(400).json({ error: 'currency is required' });
    return;
  }
  const currencyCode = body.currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    res.status(400).json({ error: 'currency must be a valid 3-letter ISO code' });
    return;
  }

  const rawAmount = body.amount_foreign as number | undefined;
  if (rawAmount === undefined || rawAmount === null || typeof rawAmount !== 'number' || isNaN(rawAmount)) {
    res.status(400).json({ error: 'amount_foreign must be a numeric value' });
    return;
  }
  if (rawAmount <= 0) {
    res.status(400).json({ error: 'amount_foreign must be greater than zero' });
    return;
  }

  // Enforce max transaction amount from config (cached)
  const maxAmount = await getMaxTransactionAmount();
  if (rawAmount > maxAmount) {
    res.status(400).json({ error: `Transaction amount exceeds the maximum allowed limit of ${maxAmount}` });
    return;
  }

  // Assign to body to keep downstream code happy
  body.amount_foreign = rawAmount;

  if (!body.denominations || typeof body.denominations !== 'object') {
    res.status(400).json({ error: 'denominations object is required' });
    return;
  }

  const hasDenomsSelected = Object.keys(body.denominations).length > 0;

  // Validate denomination keys and quantities (only when denominations are provided)
  if (hasDenomsSelected) {
    for (const [denom, qty] of Object.entries(body.denominations)) {
      if (isNaN(parseFloat(denom))) {
        res.status(400).json({ error: `Invalid denomination: ${denom}` });
        return;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        res.status(400).json({ error: `Quantity for denomination ${denom} must be a positive integer` });
        return;
      }
    }

    // Verify denomination sum matches amount_foreign
    const denomSum = Object.entries(body.denominations).reduce(
      (sum, [denom, qty]) => sum + parseFloat(denom) * qty,
      0
    );
    // Allow ±0.01 tolerance for floating-point
    if (Math.abs(denomSum - body.amount_foreign) > 0.01) {
      res.status(400).json({
        error: `Denomination breakdown (${denomSum.toFixed(2)}) does not match amount_foreign (${body.amount_foreign})`,
      });
      return;
    }
  }

  // Check currency exists
  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  if (!currency || !currency.isActive) {
    res.status(400).json({ error: `Currency ${currencyCode} is not supported or inactive` });
    return;
  }

  // --- Get rate ---
  let rates;
  try {
    rates = await getRateForCurrency(currencyCode);
  } catch {
    res.status(503).json({ error: 'Exchange rates unavailable' });
    return;
  }
  if (!rates) {
    res.status(503).json({ error: `No rate found for ${currencyCode}` });
    return;
  }

  // For BUY (bureau buys foreign): rate = buyRate (foreignPerCAD), so CAD = foreign / buyRate
  // For SELL (bureau sells foreign): rate = sellRate (foreignPerCAD), so CAD = foreign / sellRate
  const rateUsed = body.type === 'buy' ? rates.buyRate : rates.sellRate;
  const amountCad = parseFloat((body.amount_foreign / rateUsed).toFixed(2));

  // --- Till check ---
  // For SELL: bureau needs to have the foreign denominations to give out
  // For BUY: bureau needs to accept the foreign notes (always possible; we just add them)
  if (body.type === 'sell' && hasDenomsSelected) {
    const check = await checkTillSufficiency(currencyCode, body.denominations);
    if (!check.ok) {
      res.status(400).json({ error: check.missing });
      return;
    }
  }

  // --- Execute atomically ---
  let transaction;
  try {
    transaction = await prisma.$transaction(async (tx) => {
      if (body.type === 'sell') {
        // Bureau gives out foreign notes — deduct from till
        await deductFromTill(tx as any, currencyCode, body.denominations!);
      } else {
        // Bureau receives foreign notes — add to till
        await addToTill(tx as any, currencyCode, body.denominations!);
      }

      return (tx as any).transaction.create({
        data: {
          type:              body.type!,
          currencyCode,
          amountForeign:     body.amount_foreign!,
          amountCad,
          rateUsed,
          denominationsJson: body.denominations!,
        },
      });
    });
  } catch (err: any) {
    console.error('Transaction error:', err);
    res.status(500).json({ error: 'Transaction failed: ' + err.message });
    return;
  }

  const responsePayload = {
    transaction_id:    transaction.id,
    type:              transaction.type,
    currency:          currencyCode,
    currency_name:     currency.name,
    flag_emoji:        currency.flagEmoji,
    amount_foreign:    transaction.amountForeign,
    amount_cad:        transaction.amountCad,
    rate:              rateUsed,
    denominations_given:      body.type === 'sell' ? body.denominations : {},
    denominations_received:   body.type === 'buy'  ? body.denominations : {},
    timestamp:         transaction.createdAt.toISOString(),
  };

  // Broadcast to admin clients in real time
  try {
    emitTransaction(responsePayload);
    emitTillUpdated({ currency: currencyCode, timestamp: new Date().toISOString() });
  } catch {
    // socket not initialized in test mode — ignore
  }

  // Fire receipt email async — never blocks the response
  if (body.customer_email) {
    const customerEmail = body.customer_email;
    prisma.bureauConfig.findUnique({ where: { key: 'bureau_name' } }).then(cfg => {
      const bureauName = cfg?.value ?? 'Bureau Exchange';
      return sendReceiptEmail(customerEmail, {
        transactionId: transaction.id,
        currency:      currencyCode,
        type:          body.type === 'buy' ? 'BUY' : 'SELL',
        amount:        body.amount_foreign!,
        rate:          rateUsed,
        total:         amountCad,
        timestamp:     transaction.createdAt,
        bureauName,
      });
    }).catch(err => {
      console.error('[email] Failed to send receipt email:', err);
    });
  }

  res.json(responsePayload);
});

/**
 * @openapi
 * /api/transaction:
 *   get:
 *     summary: Get recent transactions
 *     description: Returns the last 100 transactions, most recent first.
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of transactions to return (max 500)
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency code
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '100', 10), 500);
  const currency = req.query.currency as string | undefined;

  const transactions = await prisma.transaction.findMany({
    where: currency ? { currencyCode: currency.toUpperCase() } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { currency: true },
  });

  res.json(
    transactions.map((t) => ({
      transaction_id:    t.id,
      type:              t.type,
      currency_code:     t.currencyCode,
      currency_name:     t.currency.name,
      flag_emoji:        t.currency.flagEmoji,
      amount_foreign:    t.amountForeign,
      amount_cad:        t.amountCad,
      rate_used:         t.rateUsed,
      denominations:     t.denominationsJson,
      timestamp:         t.createdAt.toISOString(),
    }))
  );
});

export default router;
