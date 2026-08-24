import { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[error] ${req.method} ${req.path} →`, err instanceof Error ? err.message : err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof QueryFailedError) {
    const message = String(err.message);
    if (message.includes('UNIQUE') || message.includes('unique')) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A record with the same value already exists' },
      });
      return;
    }
    if (message.includes('FOREIGN KEY') || message.includes('foreign key')) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Reference is invalid or in use' },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'DB_ERROR', message: 'Database operation failed' },
    });
    return;
  }

  if (err instanceof SyntaxError) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Malformed request body' },
    });
    return;
  }

  console.error('[error]', err);
  const message =
    err instanceof Error ? err.message : 'Something went wrong';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(env.nodeEnv === 'development' ? { detail: String(err) } : {}),
    },
  });
}
