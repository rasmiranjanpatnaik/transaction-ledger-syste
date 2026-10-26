import { NextFunction, Request, Response } from 'express';
import { ApiErrorResponse } from '../types/common.js';
import { AppError } from '../utils/errors.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction
): void {
  // Handle syntax errors (such as malformed JSON in request body)
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON payload in request body',
      },
    });
    return;
  }

  // Handle application specific errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle SQLite constraint errors if they bubble up
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A duplicate record already exists',
        details: err.message,
      },
    });
    return;
  }

  // Unhandled errors (500)
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
      ...(!isProd ? { details: err.message } : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response<ApiErrorResponse>): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    },
  });
}
