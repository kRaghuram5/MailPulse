// Augment Express namespace so req.user is typed as our User model
import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      googleId: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}
