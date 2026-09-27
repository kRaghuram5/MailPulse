import { Client } from '@elastic/elasticsearch';
import { config } from './index';
import { logger } from './logger';

let _esClient: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!_esClient) {
    _esClient = new Client({ node: config.elasticsearch.url });
  }
  return _esClient;
}

export const EMAIL_INDEX = 'email_jobs';

export async function connectElasticsearch(): Promise<void> {
  const client = getElasticsearchClient();
  try {
    const info = await client.info();
    logger.info('Elasticsearch connected', { version: info.version.number });
    await ensureEmailIndex(client);
  } catch (error) {
    logger.warn('Elasticsearch unavailable — search will be degraded', {
      error: (error as Error).message,
    });
    // Not fatal — service continues without ES
  }
}

async function ensureEmailIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: EMAIL_INDEX });
  if (!exists) {
    await client.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id:          { type: 'keyword' },
          userId:      { type: 'keyword' },
          senderId:    { type: 'keyword' },
          senderEmail: { type: 'keyword' },
          recipient:   { type: 'keyword' },
          subject:     { type: 'text', analyzer: 'standard' },
          body:        { type: 'text', analyzer: 'standard' },
          status:      { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt:      { type: 'date' },
          createdAt:   { type: 'date' },
        },
      },
    });
    logger.info(`Elasticsearch index '${EMAIL_INDEX}' created`);
  }
}
