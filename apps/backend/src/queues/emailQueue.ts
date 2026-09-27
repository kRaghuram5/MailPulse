import { Queue, QueueEvents } from 'bullmq';
import { createRedisClient } from '../config/redis';
import { logger } from '../config/logger';

export const EMAIL_QUEUE_NAME = 'email-jobs';

// Separate redis connections for Queue and QueueEvents (BullMQ requirement)
const queueRedis = createRedisClient('queue');
const eventsRedis = createRedisClient('queue-events');

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: queueRedis,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs for Bull Board
    removeOnFail: { count: 500 },      // Keep last 500 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: eventsRedis,
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.debug('Job completed', { jobId });
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Job failed', { jobId, failedReason });
});

/**
 * Add an email job to the queue with a delay.
 *
 * Idempotency: We use the emailJobId (DB primary key) as the BullMQ job ID.
 * BullMQ deduplicates by job ID within the queue, so re-adding the same job
 * is safe — it will not create a duplicate if the job already exists.
 *
 * @param emailJobId   The DB EmailJob.id (used as BullMQ job ID for deduplication)
 * @param scheduledAt  When the email should be sent
 * @returns            The BullMQ Job
 */
export async function enqueueEmailJob(
  emailJobId: string,
  scheduledAt: Date,
): Promise<string> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  const job = await emailQueue.add(
    'send-email',
    { emailJobId },
    {
      jobId: emailJobId,   // Deterministic ID = DB record ID
      delay,
    },
  );

  logger.info('Email job enqueued', {
    emailJobId,
    bullJobId: job.id,
    delay,
    scheduledAt: scheduledAt.toISOString(),
  });

  return job.id!;
}

export async function getQueueStats() {
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
  ]);

  return { waiting, active, delayed, completed, failed };
}
