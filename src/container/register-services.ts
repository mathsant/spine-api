import { asFunction, type AwilixContainer } from 'awilix';

import { makeGetHealth } from '../services/health';
import {
  makeAuthenticate,
  makeChangePassword,
  makeLogin,
  makeLogout,
  makeRefresh,
  makeSignup,
} from '../services/auth';
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
  });
}
