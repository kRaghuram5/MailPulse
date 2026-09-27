import { execSync, spawn } from 'child_process';
import { prisma } from '../config/database';
import { emailQueue } from '../queues/emailQueue';
import { scheduleEmails } from '../services/schedulingService';
import { v4 as uuidv4 } from 'uuid';
import { EmailStatus } from '@prisma/client';

async function setupTestData() {
  await prisma.emailJob.deleteMany({});
  await prisma.sender.deleteMany({});
  await prisma.user.deleteMany({});
  
  await emailQueue.obliterate({ force: true });
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      googleId: uuidv4(),
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
    }
  });

  const sender = await prisma.sender.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      email: 'sender@example.com',
      displayName: 'Sender'
    }
  });
  return { user, sender };
}

function runWorkerUntilCrash(envVar: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Starting worker with INJECT_CRASH=${envVar}...`);
    const tsNodeBin = 'node_modules/ts-node/dist/bin.js';
    const worker = spawn(process.execPath, [tsNodeBin, '--transpile-only', 'src/workers/emailWorker.ts'], {
      env: { ...process.env, INJECT_CRASH: envVar },
      stdio: 'pipe',
    });

    worker.stdout.on('data', (data) => console.log(`[Worker] ${data.toString().trim()}`));
    worker.stderr.on('data', (data) => console.error(`[Worker ERROR] ${data.toString().trim()}`));

    worker.on('close', (code) => {
      console.log(`Worker exited with code ${code}`);
      if (code === 1) resolve();
      else reject(new Error(`Worker exited with unexpected code ${code}`));
    });
  });
}

function startHealthyWorker(): Promise<{ worker: any, waitForLog: (regex: RegExp, timeoutMs: number) => Promise<boolean> }> {
  console.log(`Starting healthy worker for recovery...`);
  const tsNodeBin = 'node_modules/ts-node/dist/bin.js';
  const worker = spawn(process.execPath, [tsNodeBin, '--transpile-only', 'src/workers/emailWorker.ts'], {
    env: { ...process.env }, // No INJECT_CRASH
    stdio: 'pipe',
  });

  const waitForLog = (regex: RegExp, timeoutMs: number): Promise<boolean> => {
    return new Promise((resolve) => {
      let timeout = setTimeout(() => resolve(false), timeoutMs);
      worker.stdout.on('data', (d: any) => {
        const str = d.toString();
        console.log(`[Healthy] ${str.trim()}`);
        if (regex.test(str)) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
      worker.stderr.on('data', (d: any) => {
        console.error(`[Healthy ERROR] ${d.toString().trim()}`);
      });
    });
  };

  return Promise.resolve({ worker, waitForLog });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('--- STARTING FAILURE INJECTION TESTS ---');
  
  // Test 1: Crash in PROCESSING
  console.log('\n>>> TEST 1: Crash in PROCESSING');
  const { user: user1, sender: sender1 } = await setupTestData();
  await scheduleEmails(user1.id, {
    senderId: sender1.id,
    recipients: ['test1@example.com'],
    subject: 'Processing Crash',
    body: 'Hello',
    startTime: new Date().toISOString(),
    delayBetweenEmailsMs: 0,
    hourlyLimit: 200
  });

  // Run worker which will crash immediately upon claiming the job
  await runWorkerUntilCrash('PROCESSING');

  // Verify DB state is PROCESSING
  const jobAfterCrash1 = await prisma.emailJob.findFirst({ where: { senderId: sender1.id }});
  console.log(`Job state after crash: ${jobAfterCrash1?.status} (lockedAttempt: ${jobAfterCrash1?.lockedAttempt})`);
  
  // Wait for BullMQ stalled interval + buffer
  console.log('Waiting 20 seconds for BullMQ to detect stalled job...');
  await sleep(20000);

  // Start a healthy worker to pick up the stalled job
  const { worker: healthyWorker1, waitForLog: wait1 } = await startHealthyWorker();
  
  // Wait up to 40s for the email to be sent (ES timeout + Ethereal creation takes time)
  const sent1 = await wait1(/Email sent successfully/, 40000);
  console.log(`Test 1 Send Detected: ${sent1}`);
  healthyWorker1.kill();

  const finalJob1 = await prisma.emailJob.findFirst({ where: { senderId: sender1.id }});
  console.log(`Final DB state (Test 1): ${finalJob1?.status}, attempts in DB: ${finalJob1?.attempts}, bullJobId: ${finalJob1?.bullJobId}`);
  if (finalJob1?.status !== EmailStatus.SENT) throw new Error('Test 1 failed: Job was not recovered and SENT.');


  // Test 2: Crash in SENDING
  console.log('\n>>> TEST 2: Crash in SENDING');
  const { user: user2, sender: sender2 } = await setupTestData();
  await scheduleEmails(user2.id, {
    senderId: sender2.id,
    recipients: ['test2@example.com'],
    subject: 'Sending Crash',
    body: 'Hello',
    startTime: new Date().toISOString(),
    delayBetweenEmailsMs: 0,
    hourlyLimit: 200
  });

  // Run worker which will crash immediately upon entering SENDING
  await runWorkerUntilCrash('SENDING');

  // Verify DB state is SENDING
  const jobAfterCrash2 = await prisma.emailJob.findFirst({ where: { senderId: sender2.id }});
  console.log(`Job state after crash: ${jobAfterCrash2?.status} (lockedAttempt: ${jobAfterCrash2?.lockedAttempt})`);

  // Wait for stalled job detection
  console.log('Waiting 20 seconds for BullMQ to detect stalled job...');
  await sleep(20000);

  // Start a healthy worker
  const { worker: healthyWorker2, waitForLog: wait2 } = await startHealthyWorker();
  
  // It shouldn't send, but it should pick it up and log "Job already claimed, sending, or completed, skipping"
  const skipped = await wait2(/Job already claimed, sending, or completed, skipping/, 40000);
  console.log(`Test 2 Skip Detected: ${skipped}`);
  healthyWorker2.kill();

  const finalJob2 = await prisma.emailJob.findFirst({ where: { senderId: sender2.id }});
  console.log(`Final DB state (Test 2): ${finalJob2?.status}, attempts in DB: ${finalJob2?.attempts}`);
  if (finalJob2?.status !== EmailStatus.SENDING) throw new Error('Test 2 failed: Job state changed from SENDING, duplicate possible!');

  console.log('\n>>> BOTH FAILURE INJECTION TESTS PASSED!');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
