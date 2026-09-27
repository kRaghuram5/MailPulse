const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.emailJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      recipient: true,
      status: true,
      attempts: true,
      scheduledAt: true,
      errorMessage: true,
      createdAt: true
    }
  });
  console.log(JSON.stringify(jobs, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
