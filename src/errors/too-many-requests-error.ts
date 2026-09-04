import { AppError } from './app-error';

/**
 * Raised by the rate limiter on `login` / `signup` when the caller exceeds the
 * window budget (RF-037). Modelled as an `AppError` so the same envelope comes
 * out whether `@fastify/rate-limit` sends it (onRequest hook) or throws it
 * (preHandler hook).
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please retry later') {
    super('TOO_MANY_REQUESTS', 429, message);
  }
}
