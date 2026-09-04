import { asFunction, type AwilixContainer } from 'awilix';

import {
  makeGetBook,
  makeListWantToRead,
  makeMarkWantToRead,
  makeSearchBooks,
  makeUnmarkWantToRead,
} from '../services/books';
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
import type { AppCradle } from './cradle';

export function registerServices(container: AwilixContainer<AppCradle>): void {
  container.register({
    getHealthService: asFunction((cradle: AppCradle) =>
      makeGetHealth({ healthRepository: cradle.healthRepository }),
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
        clock: cradle.clock,
      }),
    ).singleton(),
    rejectFollowRequestService: asFunction((cradle: AppCradle) =>
      makeRejectFollowRequest({ followRequestRepository: cradle.followRequestRepository }),
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
    startReadingService: asFunction((cradle: AppCradle) =>
      makeStartReading({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        readingSessionRepository: cradle.readingSessionRepository,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    markFinishedService: asFunction((cradle: AppCradle) =>
      makeMarkFinished({
        bookRepository: cradle.bookRepository,
        openLibraryClient: cradle.openLibraryClient,
        readingSessionRepository: cradle.readingSessionRepository,
        shelfMembershipRepository: cradle.shelfMembershipRepository,
      }),
    ).singleton(),
    updateProgressService: asFunction((cradle: AppCradle) =>
      makeUpdateProgress({ readingSessionRepository: cradle.readingSessionRepository }),
    ).singleton(),
    finishReadingSessionService: asFunction((cradle: AppCradle) =>
      makeFinishReadingSession({
        readingSessionRepository: cradle.readingSessionRepository,
        clock: cradle.clock,
      }),
    ).singleton(),
    editReadingSessionService: asFunction((cradle: AppCradle) =>
      makeEditReadingSession({ readingSessionRepository: cradle.readingSessionRepository }),
    ).singleton(),
    deleteReadingSessionService: asFunction((cradle: AppCradle) =>
      makeDeleteReadingSession({ readingSessionRepository: cradle.readingSessionRepository }),
    ).singleton(),
    listReadingSessionsService: asFunction((cradle: AppCradle) =>
      makeListReadingSessions({ readingSessionRepository: cradle.readingSessionRepository }),
    ).singleton(),
  });
}
