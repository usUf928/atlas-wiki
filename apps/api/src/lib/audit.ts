import { prisma } from '../db.js';
import type { AuditAction } from '@atlas/shared';

interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        detail: input.detail ? JSON.stringify(input.detail) : null,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] 写入失败', error);
  }
}
