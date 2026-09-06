import type { FollowState } from '../follows';

export interface UserSearchResultDTO {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  /** Viewer -> this user. See `UserProfileDTO.followState`. */
  followState: FollowState;
  /** This user -> viewer (approved follow only). */
  followsYou: boolean;
}

export interface UserSearchPageDTO {
  items: UserSearchResultDTO[];
  page: number;
  limit: number;
  totalItems: number;
}

/** Response of `GET /v1/users/:userId` (011 — D1). */
export interface UserProfileDTO {
  id: string;
  handle: string;
  displayName: string;
  /** Always `null` for now — avatar upload does not exist in the API. */
  avatarUrl: string | null;
  /** Real text only when `followState === 'following'`; `null` otherwise (P6). */
  bio: string | null;
  /** Viewer -> this user: `none`, `pending` (request sent), `following` (approved). */
  followState: FollowState;
  /** This user -> viewer (approved follow only; a pending request does not count). */
  followsYou: boolean;
}
