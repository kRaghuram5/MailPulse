const Redis = require('ioredis');
const redis = new Redis();

async function main() {
  const keys = await redis.keys('sess:*');
  console.log(`Found ${keys.length} session keys.`);
  for (const key of keys) {
    const data = await redis.get(key);
    console.log(`Key: ${key}`);
    console.log(`Data: ${data}`);
  }
}
main().catch(console.error).finally(() => redis.quit());
