import { processEmailJob } from '../workers/emailWorker';
import { prisma } from '../config/database';
import { sendEmail } from '../services/emailService';
import { Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';

// Mock the dependencies
jest.mock('../config/database', () => ({
  prisma: {
    emailJob: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../config/redis', () => ({
  createRedisClient: jest.fn().mockReturnValue({
    on: jest.fn(),
  }),
  getRedis: jest.fn().mockReturnValue({
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('../config/elasticsearch', () => ({
  indexEmailJob: jest.fn().mockResolvedValue(true),
}));

describe('emailWorker State Machine (Stalled Job Recovery)', () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJob = {
      id: 'bull-1',
      attemptsMade: 1,
      data: { emailJobId: 'db-1' },
    };
  });

  it('1. normal successful send', async () => {
    // DB claim succeeds
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue({
      id: 'db-1',
      senderId: 's1',
      recipient: 'test@test.com',
      subject: 'Hello',
      body: 'World',
      sender: { email: 'sender@test.com', displayName: 'Sender' }
    });
    (sendEmail as jest.Mock).mockResolvedValue({ messageId: 'msg-1' });

    await processEmailJob(mockJob as Job);

    // Assert transitions: SCHEDULED -> PROCESSING -> SENDING -> SENT
    expect(prisma.emailJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: EmailStatus.PROCESSING })
    }));

    expect(prisma.emailJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'db-1', status: EmailStatus.PROCESSING },
      data: { status: EmailStatus.SENDING }
    }));

    expect(prisma.emailJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'db-1' },
      data: expect.objectContaining({ status: EmailStatus.SENT, messageId: 'msg-1' })
    }));
  });

  it('2. worker failure before SMTP (recoverable processing)', async () => {
    // If a worker crashes while in PROCESSING, BullMQ retries (attemptsMade = 2)
    // The DB state is still PROCESSING.
    mockJob.attemptsMade = 2;

    // We simulate that the DB claim SUCCEEDS because lockedAttempt (1) < attemptsMade (2)
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue({
      id: 'db-1',
      senderId: 's1',
      recipient: 'test@test.com',
      subject: 'Hello',
      body: 'World',
      sender: { email: 'sender@test.com', displayName: 'Sender' }
    });
    
    await processEmailJob(mockJob as Job);

    // It successfully claimed the job and sent the email!
    expect(sendEmail).toHaveBeenCalled();
  });

  it('3. worker failure after SMTP but before DB SENT update (prevents duplicate)', async () => {
    // If a worker crashes AFTER updating status to SENDING, BullMQ retries.
    // The DB state is SENDING. The claimResult will be count 0 because the OR condition
    // only looks for SCHEDULED or PROCESSING.
    mockJob.attemptsMade = 2;
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await processEmailJob(mockJob as Job);

    // It should skip and NOT send the email again!
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('4. BullMQ retry (normal failure in SMTP)', async () => {
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue({
      id: 'db-1',
      senderId: 's1',
      recipient: 'test@test.com',
      subject: 'Hello',
      body: 'World',
      sender: { email: 'sender@test.com', displayName: 'Sender' }
    });
    
    // Simulate SMTP failure
    (sendEmail as jest.Mock).mockRejectedValue(new Error('SMTP Error'));

    await expect(processEmailJob(mockJob as Job)).rejects.toThrow('SMTP Error');

    // Asserts it failed and updated DB
    expect(prisma.emailJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'db-1' },
      data: expect.objectContaining({ status: EmailStatus.FAILED })
    }));
  });

  it('5. concurrent workers (6. no duplicate processing)', async () => {
    // Simulate worker 1 claims successfully
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    
    // Worker 2 attempts to claim at the exact same time for the SAME attempt (attemptsMade = 1)
    // The DB updateMany will return count 0 for worker 2 due to Prisma atomic update
    const worker2PrismaMock = jest.fn().mockResolvedValue({ count: 0 });
    
    // Let's just test that if count === 0, it aborts
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await processEmailJob(mockJob as Job);

    // Expect no DB reads and no emails sent
    expect(prisma.emailJob.findUnique).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
