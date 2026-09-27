// Test setup — set required environment variables so tests don't fail on startup
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.SESSION_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
