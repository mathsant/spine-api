import { asFunction, type AwilixContainer } from 'awilix';

import {
  makeGetBook,
  makeListBookReviews,
  makeListPopularAmongFollowing,
  makeListWantToRead,
  makeMarkWantToRead,
  makeSearchBooks,
  makeUnmarkWantToRead,
} from '../services/books';
import { makeResolveVisibleActivity } from '../services/activities';
import { makeCreateComment, makeDeleteComment, makeListComments } from '../services/comments';
import { makeGetHealth } from '../services/health';
import { makeEditProfile } from '../services/profile';
import { makeSearchUsers } from '../services/users';
import {
  makeApproveFollowRequest,
  makeCancelFollowRequest,
  makeListFollowers,
  makeListFollowing,
  makeListFollowRequests,
  makeRejectFollowRequest,
  makeRemoveFollower,
  makeSendFollowRequest,
  makeUnfollow,
} from '../services/follows';
import {
  makeAuthenticate,
  makeChangePassword,
  makeLogin,
  makeLogout,
  makeRefresh,
  makeSignup,
} from '../services/auth';
import {
  makeDeleteReadingSession,
  makeEditReadingSession,
  makeFinishReadingSession,
  makeListReadingSessions,
  makeMarkFinished,
  makeStartReading,
  makeUpdateProgress,
} from '../services/reading-sessions';
import {
  makeCreateNotification,
  makeGetUnreadNotificationCount,
  makeListNotifications,
  makeMarkAllNotificationsRead,
  makeMarkNotificationRead,
} from '../services/notifications';
import { makeCreateReaction, makeDeleteReaction } from '../services/reactions';
import { makeCreateReview, makeDeleteReview, makeEditReview } from '../services/reviews';
import { makeGetFeed } from '../services/feed';
import type { AppCradle } from './cradle';

export function registerServices(container: AwilixContainer<AppCradle>): void {
  container.register({
    getHealthService: asFunction((cradle: AppCradle) =>
      makeGetHealth({ healthRepository: cradle.healthRepository }),
    ).singleton(),
    createNotificationService: asFunction((cradle: AppCradle) =>
      makeCreateNotification({ notificationRepository: cradle.notificationRepository, clock: cradle.clock }),
    ).singleton(),
    listNotificationsService: asFunction((cradle: AppCradle) =>
      makeListNotifications({ notificationRepository: cradle.notificationRepository }),
    ).singleton(),
    getUnreadNotificationCountService: asFunction((cradle: AppCradle) =>
      makeGetUnreadNotificationCount({ notificationRepository: cradle.notificationRepository }),
    ).singleton(),
    markNotificationReadService: asFunction((cradle: AppCradle) =>
      makeMarkNotificationRead({ notificationRepository: cradle.notificationRepository, clock: cradle.clock }),
    ).singleton(),
    markAllNotificationsReadService: asFunction((cradle: AppCradle) =>
      makeMarkAllNotificationsRead({ notificationRepository: cradle.notificationRepository, clock: cradle.clock }),
    ).singleton(),
    resolveVisibleActivityService: asFunction((cradle: AppCradle) =>
      makeResolveVisibleActivity({
        activityRepository: cradle.activityRepository,
        followRepository: cradle.followRepository,
      }),
    ).singleton(),
    authenticateService: asFunction((cradle: AppCradle) =>
      makeAuthenticate({ userRepository: cradle.userRepository, config: cradle.config }),
    ).singleton(),
    signupService: asFunction((cradle: AppCradle) =>
      makeSignup({ userRepository: cradle.userRepository }),
    ).singleton(),
    loginService: asFunction((cradle: AppCradle) =>
      makeLogin({
        userRepository: cradle.userRepository,
        authSessionRepository: cradle.authSessionRepository,
        config: cradle.config,
        clock: cradle.clock,
      }),
    ).singleton(),
    refreshService: asFunction((cradle: AppCradle) =>
      makeRefresh({
        authSessionRepository: cradle.authSessionRepository,
        config: cradle.config,
        clock: cradle.clock,
      }),
    ).singleton(),
    logoutService: asFunction((cradle: AppCradle) =>
      makeLogout({ authSessionRepository: cradle.authSessionRepository }),
    ).singleton(),
    changePasswordService: asFunction((cradle: AppCradle) =>
      makeChangePassword({
        userRepository: cradle.userRepository,
        authSessionRepository: cradle.authSessionRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    editProfileService: asFunction((cradle: AppCradle) =>
      makeEditProfile({ userRepository: cradle.userRepository, clock: cradle.clock }),
    ).singleton(),
    searchUsersService: asFunction((cradle: AppCradle) =>
      makeSearchUsers({ userRepository: cradle.userRepository }),
    ).singleton(),
    sendFollowRequestService: asFunction((cradle: AppCradle) =>
      makeSendFollowRequest({
        userRepository: cradle.userRepository,
        followRepository: cradle.followRepository,
        followRequestRepository: cradle.followRequestRepository,
        createNotification: cradle.createNotificationService,
        clock: cradle.clock,
      }),
    ).singleton(),
    cancelFollowRequestService: asFunction((cradle: AppCradle) =>
      makeCancelFollowRequest({ followRequestRepository: cradle.followRequestRepository }),
    ).singleton(),
    approveFollowRequestService: asFunction((cradle: AppCradle) =>
      makeApproveFollowRequest({
        followRequestRepository: cradle.followRequestRepository,
        followRepository: cradle.followRepository,
        notificationRepository: cradle.notificationRepository,
        createNotification: cradle.createNotificationService,
        clock: cradle.clock,
      }),
    ).singleton(),
    rejectFollowRequestService: asFunction((cradle: AppCradle) =>
      makeRejectFollowRequest({
        followRequestRepository: cradle.followRequestRepository,
        notificationRepository: cradle.notificationRepository,
      }),
    ).singleton(),
    unfollowService: asFunction((cradle: AppCradle) =>
      makeUnfollow({ followRepository: cradle.followRepository }),
    ).singleton(),
    removeFollowerService: asFunction((cradle: AppCradle) =>
      makeRemoveFollower({ followRepository: cradle.followRepository }),
    ).singleton(),
    listFollowRequestsService: asFunction((cradle: AppCradle) =>
      makeListFollowRequests({
        followRequestRepository: cradle.followRequestRepository,
        userRepository: cradle.userRepository,
      }),
    ).singleton(),
    listFollowersService: asFunction((cradle: AppCradle) =>
      makeListFollowers({
        followRepository: cradle.followRepository,
        userRepository: cradle.userRepository,
      }),
    ).singleton(),
    listFollowingService: asFunction((cradle: AppCradle) =>
      makeListFollowing({
        followRepository: cradle.followRepository,
        userRepository: cradle.userRepository,
      }),
    ).singleton(),
    searchBooksService: asFunction((cradle: AppCradle) =>
      makeSearchBooks({ openLibraryClient: cradle.openLibraryClient }),
    ).singleton(),
    getBookService: asFunction((cradle: AppCradle) =>
      makeGetBook({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        readingSessionRepository: cradle.readingSessionRepository,
        reviewRepository: cradle.reviewRepository,
      }),
    ).singleton(),
    markWantToReadService: asFunction((cradle: AppCradle) =>
      makeMarkWantToRead({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
      }),
    ).singleton(),
    unmarkWantToReadService: asFunction((cradle: AppCradle) =>
      makeUnmarkWantToRead({
        bookRepository: cradle.bookRepository,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
      }),
    ).singleton(),
    listWantToReadService: asFunction((cradle: AppCradle) =>
      makeListWantToRead({
        shelfMembershipRepository: cradle.shelfMembershipRepository,
        bookRepository: cradle.bookRepository,
      }),
    ).singleton(),
    listBookReviewsService: asFunction((cradle: AppCradle) =>
      makeListBookReviews({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        followRepository: cradle.followRepository,
        readingSessionRepository: cradle.readingSessionRepository,
        reviewRepository: cradle.reviewRepository,
        userRepository: cradle.userRepository,
      }),
    ).singleton(),
    listPopularAmongFollowingService: asFunction((cradle: AppCradle) =>
      makeListPopularAmongFollowing({
        followRepository: cradle.followRepository,
        readingSessionRepository: cradle.readingSessionRepository,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
        bookRepository: cradle.bookRepository,
      }),
    ).singleton(),
    startReadingService: asFunction((cradle: AppCradle) =>
      makeStartReading({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        readingSessionRepository: cradle.readingSessionRepository,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
        activityRepository: cradle.activityRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    markFinishedService: asFunction((cradle: AppCradle) =>
      makeMarkFinished({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        readingSessionRepository: cradle.readingSessionRepository,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
        activityRepository: cradle.activityRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    updateProgressService: asFunction((cradle: AppCradle) =>
      makeUpdateProgress({
        readingSessionRepository: cradle.readingSessionRepository,
        activityRepository: cradle.activityRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    finishReadingSessionService: asFunction((cradle: AppCradle) =>
      makeFinishReadingSession({
        readingSessionRepository: cradle.readingSessionRepository,
        activityRepository: cradle.activityRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    editReadingSessionService: asFunction((cradle: AppCradle) =>
      makeEditReadingSession({ readingSessionRepository: cradle.readingSessionRepository }),
    ).singleton(),
    deleteReadingSessionService: asFunction((cradle: AppCradle) =>
      makeDeleteReadingSession({
        readingSessionRepository: cradle.readingSessionRepository,
        reviewRepository: cradle.reviewRepository,
        activityRepository: cradle.activityRepository,
        commentRepository: cradle.commentRepository,
        reactionRepository: cradle.reactionRepository,
        notificationRepository: cradle.notificationRepository,
      }),
    ).singleton(),
    listReadingSessionsService: asFunction((cradle: AppCradle) =>
      makeListReadingSessions({
        readingSessionRepository: cradle.readingSessionRepository,
        reviewRepository: cradle.reviewRepository,
        bookRepository: cradle.bookRepository,
      }),
    ).singleton(),
    createReviewService: asFunction((cradle: AppCradle) =>
      makeCreateReview({
        reviewRepository: cradle.reviewRepository,
        readingSessionRepository: cradle.readingSessionRepository,
        activityRepository: cradle.activityRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    editReviewService: asFunction((cradle: AppCradle) =>
      makeEditReview({ reviewRepository: cradle.reviewRepository }),
    ).singleton(),
    deleteReviewService: asFunction((cradle: AppCradle) =>
      makeDeleteReview({
        reviewRepository: cradle.reviewRepository,
        activityRepository: cradle.activityRepository,
        commentRepository: cradle.commentRepository,
        reactionRepository: cradle.reactionRepository,
        notificationRepository: cradle.notificationRepository,
      }),
    ).singleton(),
    createCommentService: asFunction((cradle: AppCradle) =>
      makeCreateComment({
        commentRepository: cradle.commentRepository,
        resolveVisibleActivity: cradle.resolveVisibleActivityService,
        createNotification: cradle.createNotificationService,
        clock: cradle.clock,
      }),
    ).singleton(),
    listCommentsService: asFunction((cradle: AppCradle) =>
      makeListComments({
        commentRepository: cradle.commentRepository,
        resolveVisibleActivity: cradle.resolveVisibleActivityService,
      }),
    ).singleton(),
    deleteCommentService: asFunction((cradle: AppCradle) =>
      makeDeleteComment({
        commentRepository: cradle.commentRepository,
        notificationRepository: cradle.notificationRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    createReactionService: asFunction((cradle: AppCradle) =>
      makeCreateReaction({
        reactionRepository: cradle.reactionRepository,
        resolveVisibleActivity: cradle.resolveVisibleActivityService,
        createNotification: cradle.createNotificationService,
        clock: cradle.clock,
      }),
    ).singleton(),
    deleteReactionService: asFunction((cradle: AppCradle) =>
      makeDeleteReaction({
        reactionRepository: cradle.reactionRepository,
        resolveVisibleActivity: cradle.resolveVisibleActivityService,
        notificationRepository: cradle.notificationRepository,
      }),
    ).singleton(),
    getFeedService: asFunction((cradle: AppCradle) =>
      makeGetFeed({
        activityRepository: cradle.activityRepository,
        followRepository: cradle.followRepository,
        userRepository: cradle.userRepository,
        bookRepository: cradle.bookRepository,
        reviewRepository: cradle.reviewRepository,
        reactionRepository: cradle.reactionRepository,
      }),
    ).singleton(),
  });
}
