import type { UserRecord } from '../../repositories/users';

/** Non-sensitive user representation returned by the auth endpoints (never carries the hash). */
export interface PublicUser {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  createdAt: Date;
}

/** Token pair returned by `login` and `refresh`. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}
