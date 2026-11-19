import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { env } from '../env.js';
import type { Role } from '@atlas/shared';

export interface AccessPayload {
  sub: string;
  username: string;
  role: Role;
  type: 'access';
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function signAccessToken(user: { id: string; username: string; role: Role }): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, type: 'access' },
    env.accessSecret,
    { expiresIn: env.accessTtl as jwt.SignOptions['expiresIn'] },
  );
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti, type: 'refresh' }, env.refreshSecret, {
    expiresIn: '7d',
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const payload = jwt.verify(token, env.accessSecret) as AccessPayload;
    if (payload.type !== 'access' || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshPayload | null {
  try {
    const payload = jwt.verify(token, env.refreshSecret) as RefreshPayload;
    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
