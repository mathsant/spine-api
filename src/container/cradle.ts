import type { AppConfig } from '../config';
import type { Db, MongoClient } from '../db';
import type { OpenLibraryClient } from '../integrations/open-library';
import type { ActivityRepository } from '../repositories/activities';
import type { AuthSessionRepository } from '../repositories/auth-sessions';
import type { BookRepository } from '../repositories/books';
import type { CommentRepository } from '../repositories/comments';
import type { FollowRequestRepository } from '../repositories/follow-requests';
import type { FollowRepository } from '../repositories/follows';
import type { HealthRepository } from '../repositories/health';
import type { NotificationRepository } from '../repositories/notifications';
import type { ReactionRepository } from '../repositories/reactions';
import type { ReadingSessionRepository } from '../repositories/reading-sessions';
import type { ReviewRepository } from '../repositories/reviews';
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
import type {
  GetBook,
  ListBookReviews,
  ListPopularAmongFollowing,
  ListWantToRead,
  MarkWantToRead,
  SearchBooks,
  UnmarkWantToRead,
} from '../services/books';
import type { ResolveVisibleActivity } from '../services/activities';
import type { CreateComment, DeleteComment, ListComments } from '../services/comments';
import type { GetFeed } from '../services/feed';
import type { GetHealth } from '../services/health';
import type {
  CreateNotification,
  GetUnreadNotificationCount,
  ListNotifications,
  MarkAllNotificationsRead,
  MarkNotificationRead,
} from '../services/notifications';
import type { EditProfile, GetMyStats } from '../services/profile';
import type {
  DeleteReadingSession,
  EditReadingSession,
  FinishReadingSession,
  ListReadingSessions,
  MarkFinished,
  StartReading,
  UpdateProgress,
} from '../services/reading-sessions';
import type { CreateReview, DeleteReview, EditReview } from '../services/reviews';
import type { CreateReaction, DeleteReaction } from '../services/reactions';
import type {
  GetFollowSuggestions,
  GetUserProfile,
  ListUserActivity,
  SearchUsers,
} from '../services/users';
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
  reviewRepository: ReviewRepository;
  activityRepository: ActivityRepository;
  commentRepository: CommentRepository;
  reactionRepository: ReactionRepository;
  notificationRepository: NotificationRepository;
  getHealthService: GetHealth;
  resolveVisibleActivityService: ResolveVisibleActivity;
  authenticateService: Authenticate;
  signupService: Signup;
  loginService: Login;
  refreshService: Refresh;
  logoutService: Logout;
  changePasswordService: ChangePassword;
  editProfileService: EditProfile;
  getMyStatsService: GetMyStats;
  searchBooksService: SearchBooks;
  getBookService: GetBook;
  markWantToReadService: MarkWantToRead;
  unmarkWantToReadService: UnmarkWantToRead;
  listWantToReadService: ListWantToRead;
  listBookReviewsService: ListBookReviews;
  listPopularAmongFollowingService: ListPopularAmongFollowing;
  startReadingService: StartReading;
  markFinishedService: MarkFinished;
  updateProgressService: UpdateProgress;
  finishReadingSessionService: FinishReadingSession;
  editReadingSessionService: EditReadingSession;
  deleteReadingSessionService: DeleteReadingSession;
  listReadingSessionsService: ListReadingSessions;
  searchUsersService: SearchUsers;
  getUserProfileService: GetUserProfile;
  listUserActivityService: ListUserActivity;
  getFollowSuggestionsService: GetFollowSuggestions;
  sendFollowRequestService: SendFollowRequest;
  cancelFollowRequestService: CancelFollowRequest;
  approveFollowRequestService: ApproveFollowRequest;
  rejectFollowRequestService: RejectFollowRequest;
  unfollowService: Unfollow;
  removeFollowerService: RemoveFollower;
  listFollowRequestsService: ListFollowRequests;
  listFollowersService: ListFollowers;
  listFollowingService: ListFollowing;
  createReviewService: CreateReview;
  editReviewService: EditReview;
  deleteReviewService: DeleteReview;
  getFeedService: GetFeed;
  createReactionService: CreateReaction;
  deleteReactionService: DeleteReaction;
  createCommentService: CreateComment;
  listCommentsService: ListComments;
  deleteCommentService: DeleteComment;
  createNotificationService: CreateNotification;
  listNotificationsService: ListNotifications;
  getUnreadNotificationCountService: GetUnreadNotificationCount;
  markNotificationReadService: MarkNotificationRead;
  markAllNotificationsReadService: MarkAllNotificationsRead;
}
