import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Validates credentials against ADMIN_USER / ADMIN_PASS env vars. Returns a simple session token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  const adminUser = process.env.ADMIN_USER ?? 'admin';
  const adminPass = process.env.ADMIN_PASS ?? 'admin123';

  if (username === adminUser && password === adminPass) {
    // Simple token — base64 of "user:pass:bureau" — not a secret, just a marker
    const token = Buffer.from(`${username}:bureau-admin`).toString('base64');
    res.json({ token, username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.get('/verify', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  // Just check the token is well-formed (internal tool — no cryptographic verification needed)
  const token = auth.slice(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    if (decoded.endsWith(':bureau-admin')) {
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
