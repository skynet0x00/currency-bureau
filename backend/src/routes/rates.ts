import { Router, Request, Response } from 'express';
import { getRates, refreshRates } from '../services/rateService';
import { emitRatesUpdated } from '../socket';

const router = Router();

/**
 * @openapi
 * /api/rates:
 *   get:
 *     summary: Get all exchange rates
 *     description: Returns live buy/sell rates for all supported currencies relative to CAD. Cached for 60 seconds.
 *     tags: [Rates]
 *     responses:
 *       200:
 *         description: List of exchange rates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 base:
 *                   type: string
 *                   example: CAD
 *                 rates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rate'
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rates = await getRates();
    res.json({ base: 'CAD', rates });
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/rates/refresh:
 *   post:
 *     summary: Force-refresh exchange rates
 *     description: Bypasses the cache and fetches fresh rates from the external API immediately.
 *     tags: [Rates]
 *     responses:
 *       200:
 *         description: Refreshed rates
 */
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const rates = await refreshRates();
    try { emitRatesUpdated({ base: 'CAD', rates }); } catch { /* not initialized in test */ }
    res.json({ base: 'CAD', rates });
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

export default router;
