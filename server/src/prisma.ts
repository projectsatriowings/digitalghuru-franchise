import './dns-preload.cjs';
import './db-bridge.js';
import { PrismaClient } from '@prisma/client';

// Global singleton pattern to avoid multiple connection pools in Node/TypeScript development
declare global {
  // eslint-disable-next-line no-var
  var __tuition_prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__tuition_prisma__ ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG_QUERIES === 'true'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

// Transparent auto-reconnect middleware for Neon serverless socket dropouts (code 10054 / P1017)
prisma.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (err: any) {
    // Never disconnect mid-transaction; let the outer $transaction wrapper retry cleanly
    if ((params as any).runInTransaction) {
      throw err;
    }

    const isSocketDrop =
      err?.code === 'P1017' ||
      err?.name === 'PrismaClientInitializationError' ||
      err?.message?.includes('closed the connection') ||
      err?.message?.includes('reach database server') ||
      err?.message?.includes('10054') ||
      err?.message?.includes('ConnectionReset') ||
      err?.message?.includes('forcibly closed');

    if (isSocketDrop) {
      console.warn(`[Prisma Client] Reconnecting to database on ${params.model}.${params.action} due to transient reset...`);
      await prisma.$disconnect().catch(() => {});
      await prisma.$connect().catch(() => {});
      return await next(params);
    }
    throw err;
  }
});

// Configure default interactive transaction timeouts and transient socket retry for cloud WAN latency (Neon DB)
const originalTransaction = prisma.$transaction.bind(prisma);
prisma.$transaction = (async (arg: any, options?: any) => {
  if (typeof arg === 'function') {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await originalTransaction(arg, {
          maxWait: 15000,
          timeout: 30000,
          ...options,
        });
      } catch (err: any) {
        const isTransientSocket =
          err?.code === 'P1017' ||
          err?.code === 'P2028' ||
          err?.message?.includes('closed the connection') ||
          err?.message?.includes('10054') ||
          err?.message?.includes('ConnectionReset') ||
          err?.message?.includes('forcibly closed');

        if (attempt < 2 && isTransientSocket) {
          console.warn(`[Prisma Transaction] Retrying transaction (attempt ${attempt + 1}) after transient connection reset...`);
          await prisma.$disconnect().catch(() => {});
          await prisma.$connect().catch(() => {});
          continue;
        }
        throw err;
      }
    }
  }
  return originalTransaction(arg, options);
}) as any;

if (process.env.NODE_ENV !== 'production') {
  global.__tuition_prisma__ = prisma;
}

export default prisma;
