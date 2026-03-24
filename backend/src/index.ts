import './instrument'; // Sentry — must be first
import http from 'http';
import { createApp } from './app';
import { initSocket } from './socket';
import prisma from './db/client';
import { refreshRates } from './services/rateService';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  await prisma.$connect();
  console.log('✅ Database connected');

  // Pre-warm the rate cache so the first transactions are never slow
  try {
    await refreshRates();
    console.log('✅ Rate cache warmed');
  } catch (err) {
    console.warn('⚠️  Rate pre-warm failed (will retry on first request):', err);
  }

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
