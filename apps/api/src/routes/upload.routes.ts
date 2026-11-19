import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';

const ALLOWED = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const uploadDir = resolve(process.cwd(), env.uploadDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch((error: Error) => cb(error, uploadDir));
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) ?? '.bin';
    cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new ApiError(400, '仅支持 PNG / JPEG / WebP / GIF 图片', 400));
      return;
    }
    cb(null, true);
  },
});

async function hasValidSignature(path: string, mime: string): Promise<boolean> {
  try {
    const buffer = await readFile(path);
    if (buffer.length < 12) return false;
    if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mime === 'image/gif') return buffer.subarray(0, 3).toString('ascii') === 'GIF';
    if (mime === 'image/webp') {
      return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
  } catch {
    return false;
  }
}

export const uploadRouter = Router();

uploadRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!req.file) throw new ApiError(400, '请选择要上传的图片', 400);
    const valid = await hasValidSignature(req.file.path, req.file.mimetype);
    if (!valid) {
      await unlink(req.file.path).catch(() => undefined);
      throw new ApiError(400, '文件内容与图片类型不符', 400);
    }
    const media = await prisma.media.create({
      data: {
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`,
        mime: req.file.mimetype,
        size: req.file.size,
        uploaderId: user.id,
      },
    });
    await writeAudit({
      actorId: user.id,
      action: 'upload',
      targetType: 'media',
      targetId: media.id,
      ip: req.ip,
      detail: { filename: media.filename, size: media.size, mime: media.mime },
    });
    res.status(201).json({
      code: 0,
      data: { url: media.path, media: { id: media.id, mime: media.mime, size: media.size } },
      message: '上传成功',
    });
  }),
);

uploadRouter.get('/rules', (_req, res) => {
  res.json({
    code: 0,
    data: {
      maxBytes: env.maxUploadBytes,
      mime: [...ALLOWED.keys()],
      extensions: [...ALLOWED.values()],
    },
    message: 'ok',
  });
});
