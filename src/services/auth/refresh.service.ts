import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_INACTIVITY_DAYS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../../auth';
import {
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
  RefreshTokenReuseDetectedError,
} from '../../errors';
import type { AuthSessionRepository } from '../../repositories/auth-sessions';
import type { TokenPair } from './types';

export interface RefreshInput {
  refreshToken: string;
}

export type Refresh = (input: RefreshInput) => Promise<TokenPair>;

export interface RefreshDeps {
  authSessionRepository: Pick<
    AuthSessionRepository,
    'findRefreshTokenByHash' | 'findSessionById' | 'rotate' | 'revokeSession'
  >;
  config: { accessTokenSecret: string };
  clock: { now(): Date };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const makeRefresh =
  ({ authSessionRepository, config, clock }: RefreshDeps): Refresh =>
  async (input) => {
    const link = await authSessionRepository.findRefreshTokenByHash(
      hashRefreshToken(input.refreshToken),
    );
    if (!link) {
      throw new InvalidRefreshTokenError();
    }

    const session = await authSessionRepository.findSessionById(link.sessionId);
    if (!session || session.status === 'revoked') {
      throw new InvalidRefreshTokenError();
    }

    if (link.rotatedAt !== null) {
      await authSessionRepository.revokeSession(link.sessionId, 'reuse_detected');
      throw new RefreshTokenReuseDetectedError();
    }

    const now = clock.now();
    if (session.inactivityExpiresAt.getTime() <= now.getTime()) {
      await authSessionRepository.revokeSession(link.sessionId, 'expired');
      throw new RefreshTokenExpiredError();
    }

    const next = generateRefreshToken();
    const expiresAt = new Date(now.getTime() + REFRESH_INACTIVITY_DAYS * DAY_MS);

    const { rotated } = await authSessionRepository.rotate({
      currentTokenId: link.id,
      sessionId: link.sessionId,
      userId: link.userId,
      newTokenHash: next.tokenHash,
      now,
      inactivityExpiresAt: expiresAt,
      refreshExpiresAt: expiresAt,
    });
    if (!rotated) {
      await authSessionRepository.revokeSession(link.sessionId, 'reuse_detected');
      throw new RefreshTokenReuseDetectedError();
    }

    return {
      accessToken: signAccessToken({ userId: link.userId }, config.accessTokenSecret),
      refreshToken: next.token,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  };
