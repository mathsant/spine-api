import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import type { AppConfig } from '../../config';
import { normalizeEmail } from '../../auth';
import { changePasswordController } from './change-password.controller';
import { getMeController } from './get-me.controller';
import { loginController } from './login.controller';
import { logoutController } from './logout.controller';
import { refreshController } from './refresh.controller';
import { signupController } from './signup.controller';

export interface AuthRoutesOptions {
  appConfig: AppConfig;
}

/** Key a login attempt by origin IP *and* target email (RF-037). */
function loginRateKey(request: FastifyRequest): string {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  return `${request.ip}|${typeof email === 'string' ? normalizeEmail(email) : ''}`;
}

/**
 * Routes of the `auth` domain. Registered under `{ prefix: '/v1' }`. `signup` and
 * `login` are rate-limited (the `@fastify/rate-limit` plugin is registered in
 * `app.ts`); `change-password` and `me` require a valid access token.
 */
export const authRoutes: FastifyPluginCallback<AuthRoutesOptions> = (app, opts, done) => {
  const { authRateLimitMax, authRateLimitWindowMs } = opts.appConfig;

  app.post(
    '/auth/signup',
    { config: { rateLimit: { max: authRateLimitMax, timeWindow: authRateLimitWindowMs } } },
    signupController,
  );

  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: authRateLimitMax,
          timeWindow: authRateLimitWindowMs,
          hook: 'preHandler',
          keyGenerator: loginRateKey,
        },
      },
    },
    loginController,
  );

  app.post('/auth/refresh', refreshController);
  app.post('/auth/logout', logoutController);

  app.post(
    '/auth/change-password',
    { preHandler: app.authenticate },
    changePasswordController,
  );
  app.get('/me', { preHandler: app.authenticate }, getMeController);

  done();
};
