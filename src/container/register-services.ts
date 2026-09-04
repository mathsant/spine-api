import { asFunction, type AwilixContainer } from 'awilix';

import {
  makeGetBook,
  makeListWantToRead,
  makeMarkWantToRead,
  makeSearchBooks,
  makeUnmarkWantToRead,
} from '../services/books';
import { makeGetHealth } from '../services/health';
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
