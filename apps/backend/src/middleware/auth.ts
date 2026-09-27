import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized — please log in' });
    return;
  }
  next();
}

// For Bull Board: simple HTTP Basic Auth middleware
export function basicAuth(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');
    if (user === username && pass === password) {
      next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Invalid credentials');
    }
  };
}
