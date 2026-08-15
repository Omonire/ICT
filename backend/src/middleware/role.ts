import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `This action requires the ${roles.join(' or ')} role`
        )
      );
    }
    next();
  };
