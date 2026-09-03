import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

export interface MongoMemory {
  uri: string;
  client: MongoClient;
  stop: () => Promise<void>;
}

/** Boots an in-memory MongoDB and a connected client for integration tests. */
export async function startMongoMemory(): Promise<MongoMemory> {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri();
  const client = new MongoClient(uri);
  await client.connect();

  return {
    uri,
    client,
    stop: async () => {
      await client.close();
      await server.stop();
    },
  };
}

/** A client pointed at a port where nothing listens; commands fail fast. */
export function createUnreachableClient(): MongoClient {
  return new MongoClient('mongodb://127.0.0.1:59999/test?serverSelectionTimeoutMS=500');
}
