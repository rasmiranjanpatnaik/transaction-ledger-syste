export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code: string = 'NOT_FOUND', details?: unknown) {
    super(message, 404, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class DuplicateError extends AppError {
  constructor(message: string, code: string = 'DUPLICATE_RECORD', details?: unknown) {
    super(message, 409, code, details);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message: string = 'Insufficient balance for this transaction') {
    super(message, 400, 'INSUFFICIENT_FUNDS');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code: string = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
  }
}
