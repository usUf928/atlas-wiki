import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { atlasPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.atlasPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.atlasPrisma = prisma;
}
