import { Router, Request, Response } from 'express';
import prisma from '../db/client';

const router = Router();

const ALLOWED_KEYS = ['buy_margin', 'sell_margin', 'rate_ttl_seconds', 'max_transaction_amount', 'bureau_name'];

/**
 * @openapi
 * /api/config:
 *   get:
 *     summary: Get bureau configuration
 *     tags: [Config]
 *     responses:
 *       200:
 *         description: Key-value config map
 */
router.get('/', async (_req: Request, res: Response) => {
  const rows = await prisma.bureauConfig.findMany();
  const config: Record<string, string> = {};

  // Defaults from env (what's in DB overrides)
  config.buy_margin              = process.env.BUY_MARGIN        ?? '0.985';
  config.sell_margin             = process.env.SELL_MARGIN       ?? '1.015';
  config.rate_ttl_seconds        = process.env.RATE_TTL_SECONDS  ?? '60';
  config.max_transaction_amount  = '10000';
  config.bureau_name             = 'Bureau Exchange';

  for (const row of rows) {
    config[row.key] = row.value;
  }
  res.json(config);
});

/**
 * @openapi
 * /api/config:
 *   put:
 *     summary: Update bureau configuration
 *     tags: [Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             buy_margin: "0.98"
 *             sell_margin: "1.02"
 */
router.put('/', async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;

  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.includes(key)) {
      res.status(400).json({ error: `Unknown config key: ${key}` });
      return;
    }
    if (key === 'bureau_name') {
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        res.status(400).json({ error: 'bureau_name must be a non-empty string' });
        return;
      }
      continue;
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      res.status(400).json({ error: `Value for ${key} must be a positive number` });
      return;
    }
  }

  const ops = Object.entries(updates)
    .filter(([key]) => ALLOWED_KEYS.includes(key))
    .map(([key, value]) =>
      prisma.bureauConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

  await prisma.$transaction(ops);
  res.json({ message: 'Config updated', keys: Object.keys(updates) });
});

export default router;
