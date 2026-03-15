import { Router, Request, Response } from 'express';
import { getTillInventory, getTillSummary, restockTill } from '../services/tillService';

const router = Router();

/**
 * @openapi
 * /api/till:
 *   get:
 *     summary: Get till inventory
 *     description: Returns all denomination quantities currently held in the bureau till.
 *     tags: [Till]
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency code (e.g. USD)
 *     responses:
 *       200:
 *         description: Till inventory grouped by currency
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const currency = req.query.currency as string | undefined;
    const [summary, raw] = await Promise.all([
      getTillSummary(),
      getTillInventory(currency),
    ]);
    res.json({
      summary: currency ? undefined : summary,
      inventory: raw.map((r) => ({
        currency_code: r.currencyCode,
        denomination:  r.denomination,
        quantity:      r.quantity,
        updated_at:    r.updatedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/till/restock:
 *   put:
 *     summary: Restock till denominations
 *     description: Set absolute quantities for specific denominations of a currency.
 *     tags: [Till]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RestockRequest'
 *           example:
 *             currency: USD
 *             denominations:
 *               "100": 50
 *               "50": 80
 *               "20": 100
 *     responses:
 *       200:
 *         description: Restock successful
 *       400:
 *         description: Validation error
 */
router.put('/restock', async (req: Request, res: Response) => {
  const { currency, denominations } = req.body as {
    currency?: string;
    denominations?: Record<string, number>;
  };

  if (!currency || typeof currency !== 'string') {
    res.status(400).json({ error: 'currency is required' });
    return;
  }
  if (!denominations || typeof denominations !== 'object') {
    res.status(400).json({ error: 'denominations object is required' });
    return;
  }

  // Validate quantities
  for (const [denom, qty] of Object.entries(denominations)) {
    if (isNaN(parseFloat(denom))) {
      res.status(400).json({ error: `Invalid denomination key: ${denom}` });
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      res.status(400).json({ error: `Quantity for ${denom} must be a non-negative integer` });
      return;
    }
  }

  try {
    await restockTill(currency.toUpperCase(), denominations);
    const updated = await getTillInventory(currency.toUpperCase());
    res.json({
      message: `Till restocked for ${currency.toUpperCase()}`,
      inventory: updated.map((r) => ({
        denomination: r.denomination,
        quantity:     r.quantity,
        updated_at:   r.updatedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
