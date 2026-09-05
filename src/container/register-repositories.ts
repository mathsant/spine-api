import { asFunction, type AwilixContainer } from 'awilix';

import { MongoActivityRepository } from '../repositories/activities';
import { MongoAuthSessionRepository } from '../repositories/auth-sessions';
import { MongoBookRepository } from '../repositories/books';
import { MongoFollowRequestRepository } from '../repositories/follow-requests';
import { MongoFollowRepository } from '../repositories/follows';
import { MongoHealthRepository } from '../repositories/health';
import { MongoReadingSessionRepository } from '../repositories/reading-sessions';
import { MongoReviewRepository } from '../repositories/reviews';
import { MongoShelfMembershipRepository } from '../repositories/shelf-memberships';
import { MongoUserRepository } from '../repositories/users';
import type { AppCradle } from './cradle';

export function registerRepositories(container: AwilixContainer<AppCradle>): void {
  container.register({
    healthRepository: asFunction(
      (cradle: AppCradle) => new MongoHealthRepository(cradle.db),
    ).singleton(),
    userRepository: asFunction(
      (cradle: AppCradle) => new MongoUserRepository(cradle.db),
    ).singleton(),
    authSessionRepository: asFunction(
      (cradle: AppCradle) => new MongoAuthSessionRepository(cradle.db),
    ).singleton(),
    bookRepository: asFunction(
      (cradle: AppCradle) => new MongoBookRepository(cradle.db),
    ).singleton(),
    shelfMembershipRepository: asFunction(
      (cradle: AppCradle) => new MongoShelfMembershipRepository(cradle.db),
    ).singleton(),
    readingSessionRepository: asFunction(
      (cradle: AppCradle) => new MongoReadingSessionRepository(cradle.db),
    ).singleton(),
    followRequestRepository: asFunction(
      (cradle: AppCradle) => new MongoFollowRequestRepository(cradle.db),
    ).singleton(),
    followRepository: asFunction(
      (cradle: AppCradle) => new MongoFollowRepository(cradle.db),
    ).singleton(),
    reviewRepository: asFunction(
      (cradle: AppCradle) => new MongoReviewRepository(cradle.db),
    ).singleton(),
    activityRepository: asFunction(
      (cradle: AppCradle) => new MongoActivityRepository(cradle.db),
    ).singleton(),
  });
}
