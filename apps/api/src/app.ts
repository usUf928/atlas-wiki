import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { resolve } from 'node:path';
import { env } from './env.js';
import { attachUser } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { pagesRouter, searchRouter } from './routes/pages.routes.js';
import { commentsRouter } from './routes/comments.routes.js';
import { categoriesRouter } from './routes/categories.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { siteRouter } from './routes/site.routes.js';
import { usersRouter } from './routes/users.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    next();
  });

  app.use(
    cors({
      origin: env.appOrigin.split(',').map((item) => item.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  const uploadDir = resolve(process.cwd(), env.uploadDir);
  app.use(
    '/uploads',
    express.static(uploadDir, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
      },
    }),
  );

  app.use(attachUser);
  app.use('/api', globalLimiter);
  app.use(csrfProtection);

  app.use('/api/auth', authRouter);
  app.use('/api/pages', pagesRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api', commentsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/site', siteRouter);
  app.use('/api/users', usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
