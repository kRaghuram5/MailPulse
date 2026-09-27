const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slackConns = await prisma.slackConnection.findMany();
  console.log(JSON.stringify(slackConns, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
