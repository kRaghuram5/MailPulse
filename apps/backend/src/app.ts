import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import RedisStore from 'connect-redis';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';

import passport from './auth/passport';
import { config } from './config';
import { logger } from './config/logger';
import { createRedisClient } from './config/redis';
import { emailQueue } from './queues/emailQueue';
import { basicAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import senderRoutes from './routes/senders';

export function createApp(): express.Application {
  const app = express();

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for development ease
    }),
  );

  app.use(
    cors({
      origin: config.frontend.url,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ─── Parsing ───────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ─── Logging ───────────────────────────────────────────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    }),
  );

  // ─── Session ───────────────────────────────────────────────────────────────
  // Redis-backed session store for distributed multi-instance support
  const sessionRedis = createRedisClient('session');
  sessionRedis.connect().catch((err) =>
    logger.warn('Session Redis connect error', { error: err.message }),
  );

  app.use(
    session({
      store: new RedisStore({ client: sessionRedis as any, prefix: 'sess:' }),
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
      },
      name: 'outbox.sid',
    }),
  );

  // ─── Passport ──────────────────────────────────────────────────────────────
  app.use(passport.initialize());
  app.use(passport.session());

  // ─── Bull Board ────────────────────────────────────────────────────────────
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  app.use(
    '/admin/queues',
    basicAuth(config.bullBoard.username, config.bullBoard.password),
    serverAdapter.getRouter(),
  );

  // ─── Health ────────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // ─── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/senders', senderRoutes);

  // ─── Error handling ────────────────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
