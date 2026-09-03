import { buildApp } from './app';
import { loadConfig } from './config';
import { connectMongo, type MongoClient } from './db';
import { registerShutdownHandlers } from './lifecycle';

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // no .env file — rely on the ambient environment
  }

  const config = loadConfig(process.env);
  const app = await buildApp(config);

  const mongoClient = app.diContainer.resolve<MongoClient>('mongoClient');
  await connectMongo(mongoClient, app.log);

  await app.listen({ port: config.port, host: config.host });

  registerShutdownHandlers(app);
}

void main();
