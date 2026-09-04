import { hashPassword, hashRefreshToken, verifyPassword } from '../../auth';
import { InvalidCredentialsError } from '../../errors';
import type { AuthSessionRepository } from '../../repositories/auth-sessions';
import type { UserRepository } from '../../repositories/users';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  /** Refresh token of the calling session; when valid for this user, that session is spared. */
  refreshToken?: string;
}

export type ChangePassword = (input: ChangePasswordInput) => Promise<void>;

export interface ChangePasswordDeps {
  userRepository: Pick<UserRepository, 'findById' | 'updatePasswordHash'>;
  authSessionRepository: Pick<
    AuthSessionRepository,
    'findRefreshTokenByHash' | 'findSessionById' | 'revokeAllUserSessions'
  >;
  clock: { now(): Date };
}

export const makeChangePassword =
  ({ userRepository, authSessionRepository, clock }: ChangePasswordDeps): ChangePassword =>
  async (input) => {
    const user = await userRepository.findById(input.userId);
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    const newHash = await hashPassword(input.newPassword);
    await userRepository.updatePasswordHash(user.id, newHash, clock.now());

    let exceptSessionId: string | undefined;
    if (input.refreshToken) {
      const link = await authSessionRepository.findRefreshTokenByHash(
        hashRefreshToken(input.refreshToken),
      );
      if (link && link.userId === user.id) {
        const session = await authSessionRepository.findSessionById(link.sessionId);
        if (session && session.status === 'active') {
          exceptSessionId = link.sessionId;
        }
      }
    }

    await authSessionRepository.revokeAllUserSessions(user.id, 'password_changed', {
      exceptSessionId,
    });
  };
