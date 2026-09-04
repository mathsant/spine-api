import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { authenticateHandler } from '../../../src/http/authenticate';
import { UnauthenticatedError } from '../../../src/errors';
import type { PublicUser } from '../../../src/services/auth';

const publicUser: PublicUser = {
  id: 'u1',
  email: 'a@b.com',
  handle: 'alice',
  displayName: 'Alice',
  bio: null,
  createdAt: new Date(),
};

function fakeRequest(authorization?: string, service = vi.fn().mockResolvedValue(publicUser)) {
  return {
    headers: authorization === undefined ? {} : { authorization },
    diScope: { resolve: vi.fn().mockReturnValue(service) },
  } as unknown as FastifyRequest & { currentUser?: PublicUser };
}


describe('authenticateHandler', () => {
  it('rejects a request with no Authorization header', async () => {
    await expect(authenticateHandler(fakeRequest())).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('rejects a non-Bearer scheme', async () => {
    await expect(authenticateHandler(fakeRequest('Basic abc'))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('rejects "Bearer" with an empty value', async () => {
    await expect(authenticateHandler(fakeRequest('Bearer '))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(authenticateHandler(fakeRequest('Bearer'))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('calls authenticateService with the raw token and sets request.currentUser', async () => {
    const service = vi.fn().mockResolvedValue(publicUser);
    const request = fakeRequest('Bearer the-token', service);

    await authenticateHandler(request);

    expect(request.diScope.resolve).toHaveBeenCalledWith('authenticateService');
    expect(service).toHaveBeenCalledWith('the-token');
    expect(request.currentUser).toBe(publicUser);
  });
});
