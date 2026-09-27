import 'dotenv/config';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { connectElasticsearch } from './config/elasticsearch';
import { config } from './config';
import { logger } from './config/logger';

async function main(): Promise<void> {
  // Connect infrastructure
  await connectDatabase();
  await connectRedis();
  await connectElasticsearch(); // Non-fatal if down

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`🚀 Outbox Backend running on port ${config.port}`, {
      env: config.nodeEnv,
      bullBoard: `http://localhost:${config.port}/admin/queues`,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('Server shutdown complete');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error('Server startup failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
