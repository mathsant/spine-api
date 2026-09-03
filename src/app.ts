import { randomUUID } from 'node:crypto';

import { fastifyAwilixPlugin } from '@fastify/awilix';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { AppConfig } from './config';
import { registerContainer } from './container';
import { healthRoutes } from './controllers/health';
import { registerErrorHandler } from './http';

function loggerOptions(config: AppConfig): NonNullable<FastifyServerOptions['logger']> {
  if (config.nodeEnv === 'production') {
    return { level: config.logLevel };
  }

  return {
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
  };
}

/**
 * Builds the Fastify instance: logger (level from config, `x-request-id`
 * correlation), Awilix container, global error handler and the domain route
 * plugins. Does not listen and does not connect to MongoDB.
 */
export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(config),
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });

  await app.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: false,
    injectionMode: 'PROXY',
  });

  registerContainer(app, config);
  registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.ready();

  return app;
}
