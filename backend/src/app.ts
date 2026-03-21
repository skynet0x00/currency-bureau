import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import ratesRouter        from './routes/rates';
import tillRouter         from './routes/till';
import transactionsRouter from './routes/transactions';
import currenciesRouter   from './routes/currencies';
import authRouter         from './routes/auth';
import configRouter       from './routes/config';
import { errorHandler, notFound } from './middleware/errorHandler';

const transactionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many transaction attempts from this IP, please try again in 15 minutes.' },
});

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors({
    origin: [
      process.env.CORS_ORIGIN  ?? 'http://localhost:5173',
      process.env.ADMIN_ORIGIN ?? 'http://localhost:5174',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }));
  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Bureau API Docs',
  }));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use('/api/rates',        ratesRouter);
  app.use('/api/till',         tillRouter);
  app.use('/api/transaction',  transactionLimiter, transactionsRouter);
  app.use('/api/currencies',   currenciesRouter);
  app.use('/api/auth',         authRouter);
  app.use('/api/config',       configRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
