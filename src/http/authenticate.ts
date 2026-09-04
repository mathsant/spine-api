import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { UnauthenticatedError } from '../errors';
import type { Authenticate, PublicUser } from '../services/auth';

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler that verifies the access token and populates `request.currentUser`. */
    authenticate: preHandlerHookHandler;
  }
  interface FastifyRequest {
    currentUser?: PublicUser;
  }
}

const BEARER = /^Bearer (.+)$/;

/**
 * Reads `Authorization: Bearer <token>` (a missing header, a non-Bearer scheme or an
 * empty value → `UnauthenticatedError`), then delegates to `authenticateService`
 * which verifies the token and loads the account. Populates `request.currentUser`.
 */
export async function authenticateHandler(request: FastifyRequest): Promise<void> {
  const match = BEARER.exec(request.headers.authorization ?? '');
  if (!match) {
    throw new UnauthenticatedError();
  }

  const authenticate = request.diScope.resolve<Authenticate>('authenticateService');
  request.currentUser = await authenticate(match[1]);
}

/** Decorates `app.authenticate` with {@link authenticateHandler}. */
export function registerAuthentication(app: FastifyInstance): void {
  app.decorateRequest('currentUser', undefined);
  app.decorate('authenticate', authenticateHandler);
}
