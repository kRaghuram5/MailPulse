import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export function createRedisClient(name = 'default'): Redis {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('connect', () => logger.info(`Redis [${name}] connecting`));
  client.on('ready', () => logger.info(`Redis [${name}] ready`));
  client.on('error', (err) => logger.error(`Redis [${name}] error`, { error: err.message }));
  client.on('close', () => logger.warn(`Redis [${name}] connection closed`));
  client.on('reconnecting', () => logger.info(`Redis [${name}] reconnecting`));

  return client;
}

// Shared redis instance for general use (rate limiting, etc.)
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = createRedisClient('shared');
  }
  return _redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  await client.connect();
  logger.info('Redis connected');
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
    logger.info('Redis disconnected');
  }
}
