import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '5000'), 10),

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: parseInt(getEnv('REDIS_PORT', '6379'), 10),
  },

  elasticsearch: {
    url: getEnv('ELASTICSEARCH_URL', 'http://localhost:9200'),
  },

  google: {
    clientId: getEnv('GOOGLE_CLIENT_ID', ''),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: getEnv('GOOGLE_CALLBACK_URL', 'http://localhost:5000/api/auth/google/callback'),
  },

  slack: {
    clientId: getEnv('SLACK_CLIENT_ID', ''),
    clientSecret: getEnv('SLACK_CLIENT_SECRET', ''),
    redirectUri: getEnv('SLACK_REDIRECT_URI', 'http://localhost:5000/api/auth/slack/callback'),
  },

  session: {
    secret: getEnv('SESSION_SECRET', 'dev_secret_change_in_production'),
  },

  smtp: {
    host: getEnv('SMTP_HOST', 'smtp.ethereal.email'),
    port: parseInt(getEnv('SMTP_PORT', '587'), 10),
    user: getEnv('SMTP_USER', ''),
    password: getEnv('SMTP_PASSWORD', ''),
    from: getEnv('SMTP_FROM', 'noreply@outboxlabs.dev'),
  },

  worker: {
    concurrency: parseInt(getEnv('WORKER_CONCURRENCY', '5'), 10),
    minDelayBetweenEmailsMs: parseInt(getEnv('MIN_DELAY_BETWEEN_EMAILS_MS', '2000'), 10),
    maxEmailsPerHourPerSender: parseInt(getEnv('MAX_EMAILS_PER_HOUR_PER_SENDER', '200'), 10),
  },

  frontend: {
    url: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  },

  bullBoard: {
    username: getEnv('BULL_BOARD_USERNAME', 'admin'),
    password: getEnv('BULL_BOARD_PASSWORD', 'admin_secret'),
  },
};

export type Config = typeof config;
