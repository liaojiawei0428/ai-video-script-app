export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const ErrorCodes = {
  NOVEL_NOT_FOUND: { code: 'NOVEL_NOT_FOUND', statusCode: 404 },
  TASK_NOT_FOUND: { code: 'TASK_NOT_FOUND', statusCode: 404 },
  INVALID_FILE_TYPE: { code: 'INVALID_FILE_TYPE', statusCode: 400 },
  FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', statusCode: 413 },
  DEEPSEEK_API_ERROR: { code: 'DEEPSEEK_API_ERROR', statusCode: 502 },
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', statusCode: 500 },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', statusCode: 400 },
} as const;
