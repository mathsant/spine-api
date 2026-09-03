import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { AppError, ValidationError } from '../errors';
import { type ErrorBody, toErrorResponse } from './error-response';

export interface ResolvedError {
  statusCode: number;
  body: ErrorBody;
  /** true when the original error was unexpected (log with stack, hide from client). */
  unexpected: boolean;
}

const GENERIC_500: ErrorBody = {
  error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error', statusCode: 500 },
};

/** Pure mapping from a thrown value to an HTTP status + response envelope. */
export function resolveError(error: unknown): ResolvedError {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, body: toErrorResponse(error), unexpected: false };
  }

  if (error instanceof ZodError) {
    const validation = ValidationError.fromZodError(error);
    return {
      statusCode: validation.statusCode,
      body: toErrorResponse(validation),
      unexpected: false,
    };
  }

  return { statusCode: 500, body: GENERIC_500, unexpected: true };
}

/** Installs the global error handler: AppError | ZodError | generic 500. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const resolved = resolveError(error);

    if (resolved.unexpected) {
      request.log.error({ err: error }, 'unhandled error');
    } else {
      request.log.info({ err: error, code: resolved.body.error.code }, 'handled error');
    }

    void reply.status(resolved.statusCode).send(resolved.body);
  });
}
