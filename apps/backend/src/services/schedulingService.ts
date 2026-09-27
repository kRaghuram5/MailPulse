import { prisma } from '../config/database';
import { enqueueEmailJob } from '../queues/emailQueue';
import { indexEmailJob } from './searchService';
import { logger } from '../config/logger';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const scheduleEmailSchema = z.object({
  senderId: z.string().min(1, 'Sender ID is required'),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient is required')
    .max(1000, 'Maximum 1000 recipients per request'),
  startTime: z.string().datetime({ message: 'Invalid ISO datetime for startTime' }),
  delayBetweenEmailsMs: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().min(1).max(10000).default(200),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;

export interface ScheduleEmailResult {
  scheduledCount: number;
  jobIds: string[];
  skippedDuplicates: number;
}

/**
 * Schedule multiple emails for a given sender.
 *
 * Algorithm:
 * 1. Deduplicate recipients.
 * 2. Validate sender belongs to userId.
 * 3. Calculate scheduledAt per email:
 *    email[0] → startTime
 *    email[1] → startTime + delayBetweenEmailsMs
 *    email[n] → startTime + n * delayBetweenEmailsMs
 * 4. Create DB records with idempotencyKey = senderId:recipient:subject:scheduledAt
 * 5. Enqueue each job in BullMQ with the DB id as BullMQ job ID.
 *
 * Partial failure handling:
 * - DB record is created first.
 * - If BullMQ enqueue fails, the DB record remains with status=SCHEDULED.
 * - A reconciliation job (future improvement) can re-enqueue orphaned SCHEDULED jobs.
 * - This is safer than "BullMQ first then DB": we never lose track of an email.
 */
export async function scheduleEmails(
  userId: string,
  input: ScheduleEmailInput,
): Promise<ScheduleEmailResult> {
  // Validate sender ownership
  const sender = await prisma.sender.findFirst({
    where: { id: input.senderId, userId },
  });

  if (!sender) {
    throw new Error('Sender not found or does not belong to user');
  }

  // Deduplicate recipients
  const uniqueRecipients = [...new Set(input.recipients.map((r) => r.toLowerCase().trim()))];

  const startTime = new Date(input.startTime);
  const jobIds: string[] = [];
  let skippedDuplicates = 0;

  for (let i = 0; i < uniqueRecipients.length; i++) {
    const recipient = uniqueRecipients[i];
    const scheduledAt = new Date(startTime.getTime() + i * input.delayBetweenEmailsMs);

    // Idempotency key: ensures the same email is never duplicated on retry/restart
    const idempotencyKey = `${input.senderId}:${recipient}:${Buffer.from(input.subject).toString('base64').slice(0, 20)}:${scheduledAt.toISOString()}`;

    try {
      const emailJob = await prisma.emailJob.upsert({
        where: { idempotencyKey },
        create: {
          id: uuidv4(),
          userId,
          senderId: input.senderId,
          recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt,
          idempotencyKey,
          status: 'SCHEDULED',
        },
        update: {}, // If already exists, leave it unchanged
      });

      // Enqueue in BullMQ (idempotent: same DB id = same BullMQ job id)
      const bullJobId = await enqueueEmailJob(emailJob.id, scheduledAt);

      // Update bullJobId in DB
      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId },
      });

      // Index in ES (non-fatal)
      try {
        await indexEmailJob(emailJob.id, userId, sender.email, {
          senderId: sender.id,
          recipient,
          subject: input.subject,
          body: input.body,
          status: 'SCHEDULED',
          scheduledAt,
          createdAt: emailJob.createdAt,
        });
      } catch (esErr) {
        logger.warn('ES indexing failed on schedule (non-fatal)', {
          error: (esErr as Error).message,
        });
      }

      jobIds.push(emailJob.id);
    } catch (err) {
      const errMsg = (err as Error).message;
      if (errMsg.includes('Unique constraint') || errMsg.includes('unique')) {
        skippedDuplicates++;
        logger.debug('Duplicate email job skipped', { idempotencyKey });
      } else {
        logger.error('Failed to schedule email', { recipient, error: errMsg });
        throw err;
      }
    }
  }

  logger.info('Emails scheduled', {
    userId,
    senderId: input.senderId,
    scheduledCount: jobIds.length,
    skippedDuplicates,
  });

  return {
    scheduledCount: jobIds.length,
    jobIds,
    skippedDuplicates,
  };
}
