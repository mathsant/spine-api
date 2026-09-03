import type { AppError } from '../errors';

/** Single error envelope returned by the API (contracts/error-response.schema.json). */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

export function toErrorResponse(err: AppError): ErrorBody {
  const body: ErrorBody = {
    error: {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    },
  };

  if (err.details !== undefined) {
    body.error.details = err.details;
  }

  return body;
}
