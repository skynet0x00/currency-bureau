/**
 * Playwright screenshot script — run via:
 *   node .github/scripts/take-screenshots.mjs
 *
 * Expects the full stack to already be running:
 *   client-app → http://localhost:5173
 *   admin-app  → http://localhost:5174
 *   backend    → http://localhost:3001
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const OUT = 'docs/screenshots';
const CLIENT = 'http://localhost:5173';
const ADMIN  = 'http://localhost:5174';

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // ── Client app: exchange kiosk ──────────────────────────────────────────
  const clientPage = await ctx.newPage();
  await clientPage.goto(CLIENT, { waitUntil: 'networkidle', timeout: 30_000 });
  await clientPage.screenshot({ path: `${OUT}/client-exchange.png` });
  await clientPage.close();
  console.log('✓ client-exchange.png');

  // ── Admin app: login page ───────────────────────────────────────────────
  const adminPage = await ctx.newPage();
  await adminPage.goto(ADMIN, { waitUntil: 'networkidle', timeout: 30_000 });
  await adminPage.screenshot({ path: `${OUT}/admin-login.png` });
  console.log('✓ admin-login.png');

  // ── Admin app: log in ───────────────────────────────────────────────────
  await adminPage.fill('input[type="text"]', 'admin');
  await adminPage.fill('input[type="password"]', 'admin123');
  await adminPage.click('button[type="submit"]');
  // The admin app is a SPA — wait for the login form to unmount
  await adminPage.waitForSelector('button[type="submit"]', { state: 'detached', timeout: 10_000 })
    .catch(() => {});
  await adminPage.waitForLoadState('networkidle').catch(() => {});

  // ── Admin app: dashboard ────────────────────────────────────────────────
  await adminPage.screenshot({ path: `${OUT}/admin-dashboard.png` });
  console.log('✓ admin-dashboard.png');

  // ── Admin app: till management ──────────────────────────────────────────
  await adminPage.goto(`${ADMIN}/till`, { waitUntil: 'networkidle', timeout: 15_000 });
  await adminPage.screenshot({ path: `${OUT}/admin-till.png` });
  console.log('✓ admin-till.png');

  // ── Admin app: transactions ─────────────────────────────────────────────
  await adminPage.goto(`${ADMIN}/transactions`, { waitUntil: 'networkidle', timeout: 15_000 });
  await adminPage.screenshot({ path: `${OUT}/admin-transactions.png` });
  console.log('✓ admin-transactions.png');

  await browser.close();
  console.log('\nAll screenshots saved to', OUT);
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
