import type { AppConfig } from '../config';
import type { Db, MongoClient } from '../db';
import type { AuthSessionRepository } from '../repositories/auth-sessions';
import type { HealthRepository } from '../repositories/health';
import type { UserRepository } from '../repositories/users';
import type {
  Authenticate,
  ChangePassword,
  Login,
  Logout,
  Refresh,
  Signup,
} from '../services/auth';
import type { GetHealth } from '../services/health';

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
  healthRepository: HealthRepository;
  userRepository: UserRepository;
  authSessionRepository: AuthSessionRepository;
  getHealthService: GetHealth;
  authenticateService: Authenticate;
  signupService: Signup;
  loginService: Login;
  refreshService: Refresh;
  logoutService: Logout;
  changePasswordService: ChangePassword;
}
