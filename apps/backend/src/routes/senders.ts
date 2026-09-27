import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../config/database';
import { z } from 'zod';
import { createError } from '../middleware/errorHandler';

const router = Router();

const createSenderSchema = z.object({
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(1).max(100),
});

// GET /api/senders — list all senders for the authenticated user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string };
  const senders = await prisma.sender.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ senders });
});

// POST /api/senders — create a new sender
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string };

  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw createError(parsed.error.errors.map((e) => e.message).join(', '), 400);
  }

  const { email, displayName } = parsed.data;

  const sender = await prisma.sender.upsert({
    where: { userId_email: { userId: user.id, email } },
    create: { userId: user.id, email, displayName },
    update: { displayName },
  });

  res.status(201).json({ sender });
});

export default router;
