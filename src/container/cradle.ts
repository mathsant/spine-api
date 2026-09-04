import type { AppConfig } from '../config';
import type { Db, MongoClient } from '../db';
import type { OpenLibraryClient } from '../integrations/open-library';
import type { AuthSessionRepository } from '../repositories/auth-sessions';
import type { BookRepository } from '../repositories/books';
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
import type {
  DeleteReadingSession,
  EditReadingSession,
  FinishReadingSession,
  ListReadingSessions,
  MarkFinished,
  StartReading,
  UpdateProgress,
} from '../services/reading-sessions';

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
  getHealthService: GetHealth;
  authenticateService: Authenticate;
  signupService: Signup;
  loginService: Login;
  refreshService: Refresh;
  logoutService: Logout;
  changePasswordService: ChangePassword;
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
}
