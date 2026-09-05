import { randomUUID } from 'node:crypto';

import { fastifyAwilixPlugin } from '@fastify/awilix';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { AppConfig } from './config';
import { registerContainer } from './container';
import { authRoutes } from './controllers/auth';
import { booksRoutes } from './controllers/books';
import { feedRoutes } from './controllers/feed';
import { followsRoutes } from './controllers/follows';
import { healthRoutes } from './controllers/health';
import { profileRoutes } from './controllers/profile';
import { readingSessionsRoutes } from './controllers/reading-sessions';
import { reviewsRoutes } from './controllers/reviews';
import { usersRoutes } from './controllers/users';
import { TooManyRequestsError } from './errors';
import { registerAuthentication, registerErrorHandler } from './http';

export interface BuildAppOptions {
  /** Divert structured logs to this stream instead of stdout (used by observability tests). */
  loggerStream?: NodeJS.WritableStream;
}

function loggerOptions(
  config: AppConfig,
  options: BuildAppOptions,
): NonNullable<FastifyServerOptions['logger']> {
  if (options.loggerStream) {
    return { level: config.logLevel, stream: options.loggerStream };
  }

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
export async function buildApp(
  config: AppConfig,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(config, options),
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
  registerAuthentication(app);

  await app.register(fastifyRateLimit, {
    global: false,
    // Returned as an AppError so the global error handler produces the standard
    // envelope whether the plugin sends this (onRequest) or throws it (preHandler).
    errorResponseBuilder: () => new TooManyRequestsError(),
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1', appConfig: config });
  await app.register(booksRoutes, { prefix: '/v1' });
  await app.register(readingSessionsRoutes, { prefix: '/v1' });
  await app.register(reviewsRoutes, { prefix: '/v1' });
  await app.register(profileRoutes, { prefix: '/v1' });
  await app.register(usersRoutes, { prefix: '/v1' });
  await app.register(followsRoutes, { prefix: '/v1' });
  await app.register(feedRoutes, { prefix: '/v1' });
  await app.ready();

  return app;
}
