export interface FollowRequestDTO {
  userId: string;
  handle: string;
  displayName: string;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
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
}

export interface FollowCursorPageDTO {
  items: FollowedUserDTO[];
  nextCursor: string | null;
}
