/**
 * Email Worker
 *
 * Architecture:
 * - Uses BullMQ Worker to process delayed email jobs.
 * - Concurrency controlled by WORKER_CONCURRENCY env var.
 * - Idempotency: Uses a DB conditional UPDATE to atomically claim a job.
 *   Only one worker can transition SCHEDULED→PROCESSING. If multiple workers
 *   or restarts pick up the same job, the others will see rowsAffected=0 and skip.
 * - Minimum delay: Uses BullMQ's built-in rate limiter which is Redis-backed,
 *   ensuring distributed enforcement across multiple worker instances.
 *   Trade-off: BullMQ rate limiter groups all queue jobs; if workers are on
 *   different machines the rate limiter coordinates via Redis keys.
 * - Hourly rate limiting: Uses atomic Redis INCR+EXPIRE per sender per hour window.
 *   When limit is reached, the job is rescheduled to the next hour window and
 *   a Slack notification is sent (once per rate-limit event per sender per window).
 */

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import { createRedisClient, getRedis, connectRedis } from '../config/redis';
import { connectDatabase, prisma, disconnectDatabase } from '../config/database';
import { connectElasticsearch } from '../config/elasticsearch';
import { EMAIL_QUEUE_NAME, enqueueEmailJob } from '../queues/emailQueue';
import { sendEmail } from '../services/emailService';
import { indexEmailJob } from '../services/searchService';
import { sendSlackRateLimitNotification } from '../integrations/slack';
import { config } from '../config';
import { logger } from '../config/logger';

// Rate limit Redis key pattern: email-rate-limit:{senderId}:{hourWindow}
// hourWindow = Math.floor(Date.now() / 3_600_000) → changes every hour
function getRateLimitKey(senderId: string): { key: string; windowId: number } {
  const windowId = Math.floor(Date.now() / 3_600_000);
  return { key: `email-rate-limit:${senderId}:${windowId}`, windowId };
}

// Slack dedup key: prevents sending duplicate Slack notifications per sender per hour
function getSlackNotifKey(senderId: string, windowId: number): string {
  return `slack-notif-sent:${senderId}:${windowId}`;
}

export async function processEmailJob(job: Job): Promise<void> {
  const { emailJobId } = job.data as { emailJobId: string };
  const redis = getRedis();

  logger.info('Worker picked up job', { jobId: job.id, emailJobId, attemptsMade: job.attemptsMade });

  // ─── Step 1: Atomic claim with stalled-job recovery ───────────────────────
  // We claim if status is SCHEDULED or PROCESSING (stalled job recovery).
  // Zombie worker prevention happens right before SMTP with an atomic SENDING update.
  const claimResult = await prisma.emailJob.updateMany({
    where: {
      id: emailJobId,
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] },
    },
    data: {
      status: EmailStatus.PROCESSING,
      attempts: { increment: 1 },
    },
  });

  if (claimResult.count === 0) {
    // Already processing/sent, or in SENDING (cannot safely retry SENDING)
    logger.warn('Job already claimed, sending, or completed, skipping', { emailJobId });
    return;
  }

  if (process.env.INJECT_CRASH === 'PROCESSING') {
    logger.error('INJECTED CRASH in PROCESSING state');
    process.exit(1);
  }

  // ─── Step 2: Load the full job record ─────────────────────────────────────
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { sender: true },
  });

  if (!emailJob) {
    logger.error('EmailJob not found in DB', { emailJobId });
    return;
  }

  // ─── Step 3: Hourly rate limit check ─────────────────────────────────────
  const maxPerHour = config.worker.maxEmailsPerHourPerSender;
  const { key: rateLimitKey, windowId } = getRateLimitKey(emailJob.senderId);

  // Atomic INCR: returns new count after increment
  const currentCount = await redis.incr(rateLimitKey);

  if (currentCount === 1) {
    // First email in this hour window — set TTL so the key auto-expires
    await redis.expire(rateLimitKey, 3700); // slightly more than 1 hour for safety
  }

  if (currentCount > maxPerHour) {
    // ── Rate limited: reschedule to next hour window ──
    logger.warn('Hourly rate limit reached, rescheduling', {
      senderId: emailJob.senderId,
      senderEmail: emailJob.sender.email,
      count: currentCount,
      limit: maxPerHour,
      windowId,
    });

    // Decrement counter — this job won't actually send this window
    await redis.decr(rateLimitKey);

    // Calculate next hour boundary
    const nextWindowStart = (windowId + 1) * 3_600_000;
    const rescheduleAt = new Date(nextWindowStart);

    // Reschedule in DB
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailStatus.RATE_LIMITED,
        scheduledAt: rescheduleAt,
        errorMessage: `Rate limit (${maxPerHour}/hr) reached in window ${windowId}. Rescheduled to ${rescheduleAt.toISOString()}`,
      },
    });

    // Re-enqueue to BullMQ for next window
    // We need a new job ID since BullMQ deduplicates by ID and the old one completed
    const newJobId = `${emailJobId}-retry-${windowId + 1}`;
    const delay = Math.max(0, nextWindowStart - Date.now());
    const { emailQueue } = await import('../queues/emailQueue');
    await emailQueue.add('send-email', { emailJobId }, { jobId: newJobId, delay });

    // Update bullJobId reference
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { bullJobId: newJobId, status: EmailStatus.SCHEDULED },
    });

    // ── Send Slack notification (once per sender per hour window) ──
    const slackNotifKey = getSlackNotifKey(emailJob.senderId, windowId);
    const alreadyNotified = await redis.get(slackNotifKey);

    if (!alreadyNotified) {
      await redis.set(slackNotifKey, '1', 'EX', 3700);

      try {
        const slackConn = await prisma.slackConnection.findUnique({
          where: { userId: emailJob.userId },
        });

        if (slackConn) {
          // Count emails in RATE_LIMITED / rescheduled state for this sender/window
          const queuedCount = await prisma.emailJob.count({
            where: {
              senderId: emailJob.senderId,
              status: { in: [EmailStatus.RATE_LIMITED, EmailStatus.SCHEDULED] },
            },
          });

          await sendSlackRateLimitNotification(slackConn.accessToken, {
            senderEmail: emailJob.sender.email,
            senderDisplayName: emailJob.sender.displayName,
            limit: maxPerHour,
            windowId,
            queuedCount,
          });
        }
      } catch (slackErr) {
        // Never crash the worker due to Slack errors
        logger.error('Failed to send Slack notification', {
          error: (slackErr as Error).message,
        });
      }
    }

    return;
  }

  // ─── Step 4: Send the email ───────────────────────────────────────────────
  // Pre-Send State: Mark as SENDING to prevent retry if we crash during/after SMTP.
  // Also acts as a Zombie Worker lock: if another worker already claimed this and moved
  // it to SENDING/SENT, this will return 0 and we abort safely.
  const preSend = await prisma.emailJob.updateMany({
    where: { id: emailJobId, status: EmailStatus.PROCESSING },
    data: { status: EmailStatus.SENDING },
  });

  if (preSend.count === 0) {
    logger.warn('Lost DB lock before sending, aborting to prevent duplicate', { emailJobId });
    return;
  }

  if (process.env.INJECT_CRASH === 'SENDING') {
    logger.error('INJECTED CRASH in SENDING state');
    process.exit(1);
  }

  try {
    const result = await sendEmail({
      from: `${emailJob.sender.displayName} <${emailJob.sender.email}>`,
      to: emailJob.recipient,
      subject: emailJob.subject,
      body: emailJob.body,
    });

    const now = new Date();
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailStatus.SENT,
        sentAt: now,
        messageId: result.messageId,
        errorMessage: null,
      },
    });

    // Index in Elasticsearch (non-fatal if ES is down)
    try {
      await indexEmailJob(emailJob.id, emailJob.userId, emailJob.sender.email, {
        senderId: emailJob.senderId,
        recipient: emailJob.recipient,
        subject: emailJob.subject,
        body: emailJob.body,
        status: 'SENT',
        scheduledAt: emailJob.scheduledAt,
        sentAt: now,
        createdAt: emailJob.createdAt,
      });
    } catch (esErr) {
      logger.warn('ES indexing failed (non-fatal)', {
        error: (esErr as Error).message,
      });
    }

    logger.info('Email sent successfully', {
      emailJobId,
      recipient: emailJob.recipient,
      messageId: result.messageId,
    });
  } catch (sendError) {
    const errMsg = (sendError as Error).message;
    logger.error('Email send failed', { emailJobId, error: errMsg });

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailStatus.FAILED,
        failedAt: new Date(),
        errorMessage: errMsg,
      },
    });

    // Throw so BullMQ knows the job failed and can retry
    throw sendError;
  }
}

export async function startWorker(): Promise<Worker> {
  logger.info('Starting email worker', {
    concurrency: config.worker.concurrency,
    minDelay: config.worker.minDelayBetweenEmailsMs,
  });

  await connectDatabase();
  await connectRedis();
  await connectElasticsearch();

  const workerRedis = createRedisClient('worker');

  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: workerRedis,
    concurrency: config.worker.concurrency,
    // BullMQ rate limiter for minimum delay between sends (Redis-backed, distributed)
    // This limits the queue to 1 job per minDelayBetweenEmailsMs milliseconds
    limiter: {
      max: 1,
      duration: config.worker.minDelayBetweenEmailsMs,
    },
    lockDuration: 10000,
    stalledInterval: 10000,
  });

  worker.on('completed', (job) => {
    logger.info('Worker completed job', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Worker job failed', {
      jobId: job?.id,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Worker error', { error: err.message });
  });

  logger.info('Email worker is running and waiting for jobs');
  return worker;
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error('Worker startup failed', { error: err.message });
    process.exit(1);
  });
}
