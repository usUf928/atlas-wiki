import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@atlas/shared';
import { prisma } from '../db.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { ApiError } from '../lib/errors.js';
import { ACCESS_COOKIE } from '../lib/cookies.js';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  avatarSeed: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return next();
    const payload = verifyAccessToken(token);
    if (!payload) return next();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, avatarSeed: true, status: true },
    });
    if (!user || user.status !== 'active') return next();
    req.user = { id: user.id, username: user.username, role: user.role as Role, avatarSeed: user.avatarSeed };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuth(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, '登录后即可编辑', 401);
  }
  return req.user;
}

export function requireRole(req: Request, roles: Role[]): AuthUser {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) {
    throw new ApiError(403, '权限不足', 403);
  }
  return user;
}

export function requireEditor(req: Request): AuthUser {
  return requireRole(req, ['editor', 'admin']);
}

export function isEditor(user: AuthUser | undefined): boolean {
  return user?.role === 'editor' || user?.role === 'admin';
}

export function requireAdmin(req: Request): AuthUser {
  return requireRole(req, ['admin']);
}
