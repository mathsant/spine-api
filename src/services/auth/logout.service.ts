import { hashRefreshToken } from '../../auth';
import type { AuthSessionRepository } from '../../repositories/auth-sessions';

export interface LogoutInput {
  refreshToken: string;
}

export type Logout = (input: LogoutInput) => Promise<void>;

export interface LogoutDeps {
  authSessionRepository: Pick<AuthSessionRepository, 'findRefreshTokenByHash' | 'revokeSession'>;
}

/**
 * Revokes the session behind the given refresh token. Idempotent and silent about
 * whether the token existed (RF-030).
 */
export const makeLogout =
  ({ authSessionRepository }: LogoutDeps): Logout =>
  async (input) => {
    const link = await authSessionRepository.findRefreshTokenByHash(
      hashRefreshToken(input.refreshToken),
    );
    if (link) {
      await authSessionRepository.revokeSession(link.sessionId, 'logout');
    }
  };
