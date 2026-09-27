import { Router, Request, Response } from 'express';
import passport from '../auth/passport';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
import { prisma } from '../config/database';
import { exchangeSlackCode } from '../integrations/slack';
import { logger } from '../config/logger';
import { createError } from '../middleware/errorHandler';
import crypto from 'crypto';

const router = Router();

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.get('/google', (req: Request, res: Response, next) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    logger.error('Google OAuth credentials are not configured in environment variables');
    return res.status(500).send('Google OAuth credentials are not configured in environment variables.');
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })(req, res, next);
});

router.get('/google/callback', (req: Request, res: Response, next) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    logger.error('Google OAuth credentials missing on callback');
    return res.redirect(`${config.frontend.url}/login?error=google_credentials_missing`);
  }

  passport.authenticate('google', { session: true }, (err, user, info) => {
    if (err) {
      logger.error('Google OAuth Error:', { error: err.message, stack: err.stack });
      return res.redirect(`${config.frontend.url}/login?error=google_auth_failed`);
    }
    if (!user) {
      logger.error('Google OAuth Failed: No user returned', { info });
      return res.redirect(`${config.frontend.url}/login?error=google_auth_failed`);
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        logger.error('Session Login Error:', { error: loginErr.message });
        return next(loginErr);
      }
      return res.redirect(`${config.frontend.url}/dashboard`);
    });
  })(req, res, next);
});

// ─── Get current user ────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string; name: string; email: string; avatarUrl?: string };

  // Also check if Slack is connected
  const slackConn = await prisma.slackConnection.findUnique({
    where: { userId: user.id },
    select: { teamName: true, teamId: true },
  });

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    slack: slackConn
      ? { connected: true, teamName: slackConn.teamName, teamId: slackConn.teamId }
      : { connected: false },
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/logout', requireAuth, (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      logger.error('Logout error', { error: err.message });
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// ─── Slack OAuth ─────────────────────────────────────────────────────────────

// State map: in production, use Redis for distributed state
// Key: state token → userId; TTL 10 minutes
const slackOAuthStates = new Map<string, { userId: string; expiresAt: number }>();

router.get('/slack', requireAuth, (req: Request, res: Response) => {
  const user = req.user as { id: string };

  // Generate a random state token to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');
  slackOAuthStates.set(state, {
    userId: user.id,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const scopes = ['chat:write', 'channels:read', 'incoming-webhook'];
  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: scopes.join(','),
    redirect_uri: config.slack.redirectUri,
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

router.get('/slack/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error) {
    logger.warn('Slack OAuth denied by user', { error });
    return res.redirect(`${config.frontend.url}/dashboard?slack=denied`);
  }

  if (!code || !state) {
    return res.redirect(`${config.frontend.url}/dashboard?slack=error&reason=missing_params`);
  }

  // Validate state
  const stateData = slackOAuthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    slackOAuthStates.delete(state);
    return res.redirect(`${config.frontend.url}/dashboard?slack=error&reason=invalid_state`);
  }
  slackOAuthStates.delete(state);

  try {
    const slackData = await exchangeSlackCode(
      code,
      config.slack.redirectUri,
      config.slack.clientId,
      config.slack.clientSecret,
    );

    await prisma.slackConnection.upsert({
      where: { userId: stateData.userId },
      create: {
        userId: stateData.userId,
        accessToken: slackData.accessToken,
        teamId: slackData.teamId,
        teamName: slackData.teamName,
        botUserId: slackData.botUserId,
      },
      update: {
        accessToken: slackData.accessToken,
        teamId: slackData.teamId,
        teamName: slackData.teamName,
        botUserId: slackData.botUserId,
      },
    });

    logger.info('Slack connected', {
      userId: stateData.userId,
      teamId: slackData.teamId,
    });

    res.redirect(`${config.frontend.url}/dashboard?slack=connected`);
  } catch (err) {
    logger.error('Slack OAuth callback error', { error: (err as Error).message });
    res.redirect(`${config.frontend.url}/dashboard?slack=error&reason=oauth_failed`);
  }
});

router.post('/slack/disconnect', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as { id: string };

  await prisma.slackConnection.deleteMany({ where: { userId: user.id } });
  logger.info('Slack disconnected', { userId: user.id });

  res.json({ message: 'Slack disconnected successfully' });
});

export default router;
