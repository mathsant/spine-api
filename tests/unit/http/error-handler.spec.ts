import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { NotFoundError, ValidationError } from '../../../src/errors';
import { resolveError } from '../../../src/http/error-handler';

describe('resolveError', () => {
  it('maps an AppError subclass to its own status and envelope', () => {
    const resolved = resolveError(new NotFoundError('Book not found'));

    expect(resolved.statusCode).toBe(404);
    expect(resolved.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Book not found', statusCode: 404 },
    });
    expect(resolved.unexpected).toBe(false);
  });

  it('maps a ZodError to 400 with flattened details', () => {
    const parsed = z.object({ title: z.string() }).safeParse({});
    const error = (parsed as { error: z.ZodError }).error;

    const resolved = resolveError(error);

    expect(resolved.statusCode).toBe(400);
    expect(resolved.body.error.code).toBe('VALIDATION_ERROR');
    expect(resolved.body.error.statusCode).toBe(400);
    expect(Array.isArray(resolved.body.error.details)).toBe(true);
    expect((resolved.body.error.details as Array<{ path: string }>)[0].path).toBe('title');
  });

  it('carries details from a ValidationError built directly', () => {
    const resolved = resolveError(new ValidationError('bad', [{ path: 'x', message: 'nope' }]));

    expect(resolved.statusCode).toBe(400);
    expect(resolved.body.error.details).toEqual([{ path: 'x', message: 'nope' }]);
  });

  it('maps an unknown error to a generic 500 without leaking internals', () => {
    const resolved = resolveError(new Error('secret connection string leaked here'));

    expect(resolved.statusCode).toBe(500);
    expect(resolved.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error', statusCode: 500 },
    });
    expect(resolved.unexpected).toBe(true);
    expect(JSON.stringify(resolved.body)).not.toContain('secret');
  });
});
