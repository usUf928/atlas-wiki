import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { changePasswordSchema, loginSchema, registerSchema, emailCodeSchema } from '@atlas/shared';
import type { Role } from '@atlas/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  setCsrfCookie,
} from '../lib/cookies.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/tokens.js';
import { writeAudit } from '../lib/audit.js';
import { getSettings } from '../lib/settings.js';
import { authLimiter, captchaLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { createCaptchaSvg } from '../lib/captcha.js';

export const authRouter = Router();

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;

function clientIp(req: import('express').Request): string {
  const ip = req.ip ?? '0.0.0.0';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

async function consumeCaptcha(captchaId: string, answer: string, ip: string): Promise<{ ok: boolean; reason: string }> {
  const row = await prisma.captcha.findUnique({ where: { id: captchaId } });
  if (!row) return { ok: false, reason: 'captcha_not_found' };
  const consumed = await prisma.captcha.updateMany({
    where: { id: captchaId, consumed: false, expiresAt: { gt: new Date() } },
    data: { consumed: true },
  });
  if (consumed.count === 0) {
    return { ok: false, reason: row.consumed ? 'captcha_used' : 'captcha_expired' };
  }
  if (row.ip !== ip) return { ok: false, reason: 'captcha_ip_mismatch' };
  if (row.answer !== answer.trim().toLowerCase()) return { ok: false, reason: 'captcha_mismatch' };
  return { ok: true, reason: 'ok' };
}

async function issueSession(
  res: import('express').Response,
  user: { id: string; username: string; role: string },
  userAgent?: string,
): Promise<string> {
  const accessToken = signAccessToken({ id: user.id, username: user.username, role: user.role as Role });
  const { token: refreshToken } = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.refreshTtlMs),
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
  });
  setAuthCookies(res, accessToken, refreshToken);
  return refreshToken;
}

function publicUser(user: {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  avatarSeed: string;
  bio: string;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarSeed: user.avatarSeed,
    bio: user.bio,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

authRouter.get('/csrf', (req, res) => {
  const token = setCsrfCookie(res);
  res.json({ code: 0, data: { csrfToken: token }, message: 'ok' });
});

authRouter.get(
  '/captcha',
  captchaLimiter,
  asyncHandler(async (req, res) => {
    const { svg, answer } = createCaptchaSvg();
    const captchaId = randomUUID();
    const ip = clientIp(req);
    await prisma.captcha.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } });
    await prisma.captcha.create({
      data: { id: captchaId, answer, ip, expiresAt: new Date(Date.now() + CAPTCHA_TTL_MS) },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ code: 0, data: { captchaId, svg }, message: 'ok' });
  }),
);

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@atlas/shared').RegisterInput;
    const ip = clientIp(req);
    const settings = await getSettings();
    if (!settings.allowRegistration) {
      throw new ApiError(403, '站点已关闭注册', 403);
    }

    const captcha = await consumeCaptcha(body.captchaId, body.captchaAnswer, ip);
    if (!captcha.ok) {
      console.warn(`[register] 验证码失败: ${captcha.reason} ip=${ip}`);
      throw new ApiError(422, '注册信息有误，请检查后重试', 422);
    }

    const exists = await prisma.user.findFirst({
      where: { OR: [{ username: body.username }, { email: body.email }] },
      select: { id: true, username: true, email: true },
    });
    if (exists) {
      console.warn(`[register] 唯一性冲突 ip=${ip} username=${body.username}`);
      throw new ApiError(422, '注册信息有误，请检查后重试', 422);
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        passwordHash,
        role: 'user',
        avatarSeed: randomBytes(6).toString('hex'),
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    await issueSession(res, user, req.get('user-agent') ?? undefined);
    await writeAudit({ actorId: user.id, action: 'register', targetType: 'user', targetId: user.id, ip });
    await writeAudit({ actorId: user.id, action: 'login', targetType: 'user', targetId: user.id, ip });

    res.status(201).json({ code: 0, data: { user: publicUser(user) }, message: '注册成功' });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@atlas/shared').LoginInput;
    const ip = clientIp(req);
    const captcha = await consumeCaptcha(body.captchaId, body.captchaAnswer, ip);
    if (!captcha.ok) {
      console.warn(`[login] 验证码失败: ${captcha.reason} ip=${ip}`);
      throw new ApiError(422, '验证码错误或已失效，请刷新后重试', 422);
    }

    const identifier = body.identifier.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
      },
    });

    if (!user) {
      console.warn(`[login] 账号不存在 ip=${ip}`);
      throw new ApiError(401, '用户名或密码错误', 401);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      throw new ApiError(423, `账号已锁定，请 ${minutes} 分钟后再试`, 423);
    }

    if (user.status !== 'active') {
      throw new ApiError(403, '账号已被封禁，请联系管理员', 403);
    }

    const passwordOk = await verifyPassword(body.password, user.passwordHash);
    if (!passwordOk) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil = failedLoginCount >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MS) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedLoginCount >= LOCK_THRESHOLD ? 0 : failedLoginCount,
          lockedUntil,
        },
      });
      if (lockedUntil) {
        console.warn(`[login] 账号锁定 ip=${ip} user=${user.username}`);
        throw new ApiError(423, '连续失败 5 次，账号已锁定 15 分钟', 423);
      }
      throw new ApiError(401, '用户名或密码错误', 401);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    await issueSession(res, updated, req.get('user-agent') ?? undefined);
    await writeAudit({
      actorId: updated.id,
      action: 'login',
      targetType: 'user',
      targetId: updated.id,
      ip,
      detail: { username: updated.username },
    });

    res.json({ code: 0, data: { user: publicUser(updated) }, message: '登录成功' });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new ApiError(401, '登录状态已失效', 401);
    const payload = verifyRefreshToken(token);
    if (!payload) throw new ApiError(401, '登录状态已失效', 401);

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      await prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      clearAuthCookies(res);
      throw new ApiError(401, '登录状态已失效，请重新登录', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'active') {
      clearAuthCookies(res);
      throw new ApiError(403, '账号不可用', 403);
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await issueSession(res, user, req.get('user-agent') ?? undefined);
    res.json({ code: 0, data: { user: publicUser(user) }, message: '已刷新登录状态' });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const accessToken = req.cookies?.['atlas_access'];
    if (accessToken) {
      void accessToken;
    }
    clearAuthCookies(res);
    if (req.user) {
      await writeAudit({ actorId: req.user.id, action: 'logout', targetType: 'user', targetId: req.user.id, ip: clientIp(req) });
    }
    res.json({ code: 0, data: null, message: '已退出登录' });
  }),
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      if (req.cookies?.[REFRESH_COOKIE]) {
        throw new ApiError(401, '登录状态已过期，正在刷新', 401);
      }
      res.json({ code: 0, data: { user: null }, message: 'ok' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.json({ code: 0, data: { user: null }, message: 'ok' });
      return;
    }
    res.json({ code: 0, data: { user: publicUser(user) }, message: 'ok' });
  }),
);

authRouter.post(
  '/change-password',
  authLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const current = requireAuth(req);
    const body = req.body as import('@atlas/shared').ChangePasswordInput;
    const user = await prisma.user.findUnique({ where: { id: current.id } });
    if (!user) throw new ApiError(401, '登录状态无效', 401);
    const ok = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!ok) throw new ApiError(400, '当前密码不正确', 400);
    if (body.currentPassword === body.newPassword) {
      throw new ApiError(400, '新密码不能与当前密码相同', 400);
    }
    const passwordHash = await hashPassword(body.newPassword);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await issueSession(res, updated, req.get('user-agent') ?? undefined);
    await writeAudit({
      actorId: user.id,
      action: 'password_reset',
      targetType: 'user',
      targetId: user.id,
      ip: clientIp(req),
      detail: { self: true },
    });
    res.json({ code: 0, data: { user: publicUser(updated) }, message: '密码已更新' });
  }),
);

authRouter.post(
  '/email-code',
  authLimiter,
  validate(emailCodeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import('@atlas/shared').EmailCodeInput;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.setting.upsert({
      where: { key: `emailcode:${body.email}` },
      update: { value: JSON.stringify({ code, purpose: body.purpose, expiresAt: expiresAt.toISOString() }) },
      create: {
        key: `emailcode:${body.email}`,
        value: JSON.stringify({ code, purpose: body.purpose, expiresAt: expiresAt.toISOString() }),
      },
    });
    console.log(`[email-code] ${body.email} (${body.purpose}) => ${code}，10 分钟内有效`);
    res.json({
      code: 0,
      data: { expiresIn: 600, devHint: env.isProd ? null : code },
      message: '如果邮箱可用，验证码已发送',
    });
  }),
);
