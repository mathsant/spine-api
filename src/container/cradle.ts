import type { AppConfig } from '../config';
import type { Db, MongoClient } from '../db';
import type { OpenLibraryClient } from '../integrations/open-library';
import type { AuthSessionRepository } from '../repositories/auth-sessions';
import type { BookRepository } from '../repositories/books';
import type { FollowRequestRepository } from '../repositories/follow-requests';
import type { FollowRepository } from '../repositories/follows';
import type { HealthRepository } from '../repositories/health';
import type { ReadingSessionRepository } from '../repositories/reading-sessions';
import type { ShelfMembershipRepository } from '../repositories/shelf-memberships';
import type { UserRepository } from '../repositories/users';
import type {
  Authenticate,
  ChangePassword,
  Login,
  Logout,
  Refresh,
  Signup,
} from '../services/auth';
import type { GetBook, ListWantToRead, MarkWantToRead, SearchBooks, UnmarkWantToRead } from '../services/books';
import type { GetHealth } from '../services/health';
import type { EditProfile } from '../services/profile';
import type {
  DeleteReadingSession,
  EditReadingSession,
  FinishReadingSession,
  ListReadingSessions,
  MarkFinished,
  StartReading,
  UpdateProgress,
} from '../services/reading-sessions';
import type { SearchUsers } from '../services/users';
import type {
  ApproveFollowRequest,
  CancelFollowRequest,
  ListFollowers,
  ListFollowing,
  ListFollowRequests,
  RejectFollowRequest,
  RemoveFollower,
  SendFollowRequest,
  Unfollow,
} from '../services/follows';

/** Wall-clock source, injected so time-dependent rules are testable. */
export interface Clock {
  now(): Date;
}

/**
 * Everything resolvable from the Awilix container.
 * Registered via `registerInfrastructure` / `registerRepositories` / `registerServices`.
 */
export interface AppCradle {
  config: AppConfig;
  clock: Clock;
  mongoClient: MongoClient;
  db: Db;
  openLibraryClient: OpenLibraryClient;
  healthRepository: HealthRepository;
  userRepository: UserRepository;
  authSessionRepository: AuthSessionRepository;
  bookRepository: BookRepository;
  shelfMembershipRepository: ShelfMembershipRepository;
  readingSessionRepository: ReadingSessionRepository;
  followRequestRepository: FollowRequestRepository;
  followRepository: FollowRepository;
  getHealthService: GetHealth;
  authenticateService: Authenticate;
  signupService: Signup;
  loginService: Login;
  refreshService: Refresh;
  logoutService: Logout;
  changePasswordService: ChangePassword;
  editProfileService: EditProfile;
  searchBooksService: SearchBooks;
  getBookService: GetBook;
  markWantToReadService: MarkWantToRead;
  unmarkWantToReadService: UnmarkWantToRead;
  listWantToReadService: ListWantToRead;
  startReadingService: StartReading;
  markFinishedService: MarkFinished;
  updateProgressService: UpdateProgress;
  finishReadingSessionService: FinishReadingSession;
  editReadingSessionService: EditReadingSession;
  deleteReadingSessionService: DeleteReadingSession;
  listReadingSessionsService: ListReadingSessions;
  searchUsersService: SearchUsers;
  sendFollowRequestService: SendFollowRequest;
  cancelFollowRequestService: CancelFollowRequest;
  approveFollowRequestService: ApproveFollowRequest;
  rejectFollowRequestService: RejectFollowRequest;
  unfollowService: Unfollow;
  removeFollowerService: RemoveFollower;
  listFollowRequestsService: ListFollowRequests;
  listFollowersService: ListFollowers;
  listFollowingService: ListFollowing;
}
