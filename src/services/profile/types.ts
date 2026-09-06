export interface ProfileDTO {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
}

/** Response of `GET /v1/me/stats` (011 — D3). All fields are integers `>= 0`. */
export interface MyStatsDTO {
  /** Distinct books with >= 1 finished reading session. A reread counts once. */
  booksRead: number;
  /** Approved follows where the user is the followee. */
  followers: number;
  /** Approved follows where the user is the follower. */
  following: number;
  /** Pending follow requests received (not the ones the user sent). */
  pendingFollowRequests: number;
  /** Want-to-read marks of the user. */
  wantToRead: number;
}
