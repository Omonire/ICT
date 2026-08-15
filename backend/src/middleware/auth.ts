import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { AppError } from '../utils/errors';

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = (req.cookies?.token as string | undefined) ?? extractBearer(req);
    if (!token) throw AppError.unauthorized();

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    } catch {
      throw AppError.unauthorized('Session expired or invalid');
    }

    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: payload.sub } });
    if (!user) throw AppError.unauthorized('Account no longer exists');

    req.user = user;
    req.userRole = user.role;
    next();
  } catch (err) {
    next(err);
  }
}

export function extractBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}
