import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import {
  scheduleEmails,
  scheduleEmailSchema,
  ScheduleEmailInput,
} from '../services/schedulingService';
import { searchEmailJobs } from '../services/searchService';
import { createError } from '../middleware/errorHandler';

const router = Router();

// POST /api/emails/schedule — schedule new emails
router.post(
  '/schedule',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as { id: string };

      const parsed = scheduleEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createError(
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          400,
        );
      }

      const result = await scheduleEmails(user.id, parsed.data as ScheduleEmailInput);

      res.status(201).json({
        message: `${result.scheduledCount} email(s) scheduled successfully`,
        scheduledCount: result.scheduledCount,
        skippedDuplicates: result.skippedDuplicates,
        jobIds: result.jobIds,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/emails/scheduled — list scheduled/pending emails
router.get('/scheduled', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string };
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const skip = (page - 1) * limit;

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: {
        userId: user.id,
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      },
      include: { sender: { select: { email: true, displayName: true } } },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.emailJob.count({
      where: {
        userId: user.id,
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      },
    }),
  ]);

  res.json({ emails, total, page, limit });
});

// GET /api/emails/sent — list sent/failed emails
router.get('/sent', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string };
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const skip = (page - 1) * limit;

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: {
        userId: user.id,
        status: { in: ['SENT', 'FAILED'] },
      },
      include: { sender: { select: { email: true, displayName: true } } },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.emailJob.count({
      where: {
        userId: user.id,
        status: { in: ['SENT', 'FAILED'] },
      },
    }),
  ]);

  res.json({ emails, total, page, limit });
});

// GET /api/emails/search?q= — full-text search via Elasticsearch
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string };
  const q = (req.query.q as string)?.trim();

  if (!q) {
    throw createError('Query parameter "q" is required', 400);
  }

  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
  const from = (page - 1) * limit;

  try {
    const { results, total } = await searchEmailJobs(user.id, q, from, limit);
    res.json({ results, total, page, limit });
  } catch (esErr) {
    // ES unavailable — fall back to DB search
    const emails = await prisma.emailJob.findMany({
      where: {
        userId: user.id,
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { recipient: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { sender: { select: { email: true, displayName: true } } },
      take: limit,
      skip: from,
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      results: emails,
      total: emails.length,
      page,
      limit,
      fallback: true,
      fallbackReason: 'Elasticsearch unavailable',
    });
  }
});

export default router;
