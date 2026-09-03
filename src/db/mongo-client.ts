import type { FastifyBaseLogger } from 'fastify';
import { MongoClient } from 'mongodb';

import type { AppConfig } from '../config';

export type { Db, MongoClient } from 'mongodb';

/** Builds the client. Does not open a connection. */
export function createMongoClient(config: AppConfig): MongoClient {
  return new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 2000,
  });
}

/**
 * Attempts to connect. A failure here is logged and swallowed on purpose:
 * the app still boots and `GET /health` reports `db: "down"` (RF-019).
 */
export async function connectMongo(client: MongoClient, logger: FastifyBaseLogger): Promise<void> {
  try {
    await client.connect();
    logger.info('connected to MongoDB');
  } catch (error) {
    logger.error({ err: error }, 'failed to connect to MongoDB on startup; continuing');
  }
}
