import { getElasticsearchClient, EMAIL_INDEX } from '../config/elasticsearch';
import { logger } from '../config/logger';

interface EmailJobDocument {
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}

export async function indexEmailJob(
  id: string,
  userId: string,
  senderEmail: string,
  doc: EmailJobDocument,
): Promise<void> {
  const client = getElasticsearchClient();
  await client.index({
    index: EMAIL_INDEX,
    id,
    document: {
      id,
      userId,
      ...doc,
      senderEmail,
      scheduledAt: doc.scheduledAt?.toISOString(),
      sentAt: doc.sentAt?.toISOString() ?? null,
      createdAt: doc.createdAt?.toISOString(),
    },
    refresh: true,
  });
}

export interface SearchResult {
  id: string;
  userId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
}

export async function searchEmailJobs(
  userId: string,
  query: string,
  from = 0,
  size = 20,
): Promise<{ results: SearchResult[]; total: number }> {
  const client = getElasticsearchClient();

  try {
    const response = await client.search({
      index: EMAIL_INDEX,
      from,
      size,
      query: {
        bool: {
          must: [
            { term: { userId } },
            {
              multi_match: {
                query,
                fields: ['subject^2', 'body', 'recipient'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const hits = response.hits.hits;
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value ?? 0;

    const results: SearchResult[] = hits.map((hit) => ({
      ...(hit._source as SearchResult),
    }));

    return { results, total };
  } catch (error) {
    logger.error('Elasticsearch search failed', { error: (error as Error).message });
    throw error;
  }
}
