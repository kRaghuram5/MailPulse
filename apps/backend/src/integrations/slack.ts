import { logger } from '../config/logger';

interface RateLimitNotificationPayload {
  senderEmail: string;
  senderDisplayName: string;
  limit: number;
  windowId: number;
  queuedCount: number;
}

/**
 * Send a Slack notification when a sender hits its hourly rate limit.
 * Uses the Slack Web API (chat.postMessage) with the stored bot access token.
 */
export async function sendSlackRateLimitNotification(
  accessToken: string,
  payload: RateLimitNotificationPayload,
): Promise<void> {
  const windowStart = new Date(payload.windowId * 3_600_000).toISOString();
  const windowEnd = new Date((payload.windowId + 1) * 3_600_000).toISOString();

  const text = [
    `⚠️ *Hourly Email Rate Limit Reached*`,
    ``,
    `*Sender:* ${payload.senderDisplayName} (${payload.senderEmail})`,
    `*Limit:* ${payload.limit} emails/hour`,
    `*Window:* ${windowStart} → ${windowEnd}`,
    `*Queued/Rate-limited:* ${payload.queuedCount} email(s) rescheduled to next window`,
  ].join('\n');

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      channel: 'general', // Posts to #general; could be made configurable
      text,
      mrkdwn: true,
    }),
  });

  const data = (await response.json()) as { ok: boolean; error?: string };

  if (!data.ok) {
    logger.error('Slack notification failed', { slackError: data.error });
    throw new Error(`Slack API error: ${data.error}`);
  }

  logger.info('Slack rate-limit notification sent', {
    senderEmail: payload.senderEmail,
  });
}

/**
 * Exchange a Slack OAuth code for an access token.
 */
export async function exchangeSlackCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<{
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId?: string;
}> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const data = (await response.json()) as {
    ok: boolean;
    access_token?: string;
    team?: { id: string; name: string };
    bot_user_id?: string;
    error?: string;
  };

  if (!data.ok || !data.access_token || !data.team) {
    throw new Error(`Slack OAuth failed: ${data.error || 'Unknown error'}`);
  }

  return {
    accessToken: data.access_token,
    teamId: data.team.id,
    teamName: data.team.name,
    botUserId: data.bot_user_id,
  };
}
