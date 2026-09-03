import type { ZodError } from 'zod';

import { AppError } from './app-error';

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Raised when external input fails schema validation. Carries the offending fields in `details`. */
export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', issues: ValidationIssue[] = []) {
    super('VALIDATION_ERROR', 400, message, { details: issues });
  }

  static fromZodError(error: ZodError, message?: string): ValidationError {
    const issues: ValidationIssue[] = error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.'),
      message: issue.message,
    }));
    return new ValidationError(message ?? 'Request validation failed', issues);
  }
}
