import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { AppError, asyncHandler } from '../utils/errors';
import { logActivity } from '../services/activity-log';
import type { AuthPayload } from '../middleware/auth';

const COOKIE_NAME = 'token';

function setTokenCookie(res: Response, payload: AuthPayload): void {
  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const repo = AppDataSource.getRepository(User);
  const user = await repo
    .createQueryBuilder('user')
    .addSelect('user.password')
    .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
    .getOne();

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw AppError.unauthorized('Invalid email or password');
  }

  setTokenCookie(res, { sub: user.id, email: user.email, role: user.role });
  await logActivity({ action: 'login', userId: user.id, entityType: 'user', entityId: user.id });

  res.json({ user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  res.json({ user: req.user.toSafeJSON() });
});
