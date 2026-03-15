import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { SUPPORTED_CURRENCIES } from '../services/rateService';

const router = Router();

/**
 * @openapi
 * /api/currencies:
 *   get:
 *     summary: List all supported currencies
 *     tags: [Currencies]
 *     responses:
 *       200:
 *         description: Array of currency objects
 */
router.get('/', async (_req: Request, res: Response) => {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true, code: { in: SUPPORTED_CURRENCIES } },
    orderBy: { code: 'asc' },
  });
  res.json(currencies.map((c) => ({
    code:       c.code,
    name:       c.name,
    flag_emoji: c.flagEmoji,
    is_active:  c.isActive,
  })));
});

/**
 * @openapi
 * /api/currencies/{code}/denominations:
 *   get:
 *     summary: Get denomination list for a currency
 *     tags: [Currencies]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:code/denominations', async (req: Request, res: Response) => {
  const code = (req.params.code as string).toUpperCase();
  const inventory = await prisma.tillInventory.findMany({
    where: { currencyCode: code },
    orderBy: { denomination: 'asc' },
  });
  if (inventory.length === 0) {
    res.status(404).json({ error: `No denominations found for ${code}` });
    return;
  }
  res.json({
    currency_code: code,
    denominations: inventory.map((r) => ({ denomination: r.denomination, quantity: r.quantity })),
  });
});

export default router;
