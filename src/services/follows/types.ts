import type { FollowState } from './resolve-relationships';

export interface FollowRequestDTO {
  userId: string;
  handle: string;
  displayName: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  /** Viewer -> this user. In `direction: outgoing` this is always `pending`. */
  followState: FollowState;
  /** This user -> viewer (approved follow only). In `direction: incoming` this is
   * `false` until the viewer approves the request. */
  followsYou: boolean;
}

export interface FollowRequestCursorPageDTO {
  items: FollowRequestDTO[];
  nextCursor: string | null;
}

/** Return of `sendFollowRequest` — a different shape from `FollowRequestDTO` (that one is for listings, with the other side's handle/displayName/direction). */
export interface FollowRequestCreationDTO {
  requesterId: string;
  targetId: string;
  createdAt: string;
}

export interface FollowedUserDTO {
  userId: string;
  handle: string;
  displayName: string;
  createdAt: string;
  /** Viewer -> this user. In `GET /me/following` this is always `following`. */
  followState: FollowState;
  /** This user -> viewer (approved follow only). In `GET /me/followers` this is always `true`. */
  followsYou: boolean;
}

export interface FollowCursorPageDTO {
  items: FollowedUserDTO[];
  nextCursor: string | null;
}
