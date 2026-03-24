import './instrument'; // Sentry — must be first
import http from 'http';
import { createApp } from './app';
import { initSocket } from './socket';
import prisma from './db/client';
import { refreshRates } from './services/rateService';

const PORT         = parseInt(process.env.PORT         ?? '3001', 10);
const RATE_TTL_MS  = parseInt(process.env.RATE_TTL_SECONDS ?? '60', 10) * 1000;

async function main() {
  await prisma.$connect();
  console.log('✅ Database connected');

  // Pre-warm the rate cache so the very first transaction is never slow
  try {
    await refreshRates();
    console.log('✅ Rate cache warmed');
  } catch (err) {
    console.warn('⚠️  Rate pre-warm failed (will retry on schedule):', err);
  }

  // Keep rates perpetually fresh — refresh on a background interval so
  // no transaction ever blocks on an external Frankfurter API call.
  // Refresh at 90 % of TTL so there is always headroom before expiry.
  const refreshInterval = Math.max(RATE_TTL_MS * 0.9, 10_000);
  setInterval(async () => {
    try {
      await refreshRates();
    } catch (err) {
      console.warn('⚠️  Background rate refresh failed:', err);
    }
  }, refreshInterval);

  const app    = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`🚀 Bureau API  →  http://localhost:${PORT}`);
    console.log(`📖 Swagger UI  →  http://localhost:${PORT}/api/docs`);
    console.log(`⚡ WebSockets  →  ws://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
