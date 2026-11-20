"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
require("./dns-preload.js");
require("./db-bridge.js");
const client_1 = require("@prisma/client");
exports.prisma = global.__tuition_prisma__ ||
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG_QUERIES === 'true'
            ? ['query', 'info', 'warn', 'error']
            : ['warn', 'error'],
    });
// Transparent auto-reconnect middleware for Neon serverless socket dropouts (code 10054 / P1017)
exports.prisma.$use(async (params, next) => {
    try {
        return await next(params);
    }
    catch (err) {
        // Never disconnect mid-transaction; let the outer $transaction wrapper retry cleanly
        if (params.runInTransaction) {
            throw err;
        }
        const isSocketDrop = err?.code === 'P1017' ||
            err?.name === 'PrismaClientInitializationError' ||
            err?.message?.includes('closed the connection') ||
            err?.message?.includes('reach database server') ||
            err?.message?.includes('10054') ||
            err?.message?.includes('ConnectionReset') ||
            err?.message?.includes('forcibly closed');
        if (isSocketDrop) {
            console.warn(`[Prisma Client] Reconnecting to database on ${params.model}.${params.action} due to transient reset...`);
            await exports.prisma.$disconnect().catch(() => { });
            await exports.prisma.$connect().catch(() => { });
            return await next(params);
        }
        throw err;
    }
});
// Configure default interactive transaction timeouts and transient socket retry for cloud WAN latency (Neon DB)
const originalTransaction = exports.prisma.$transaction.bind(exports.prisma);
exports.prisma.$transaction = (async (arg, options) => {
    if (typeof arg === 'function') {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                return await originalTransaction(arg, {
                    maxWait: 15000,
                    timeout: 30000,
                    ...options,
                });
            }
            catch (err) {
                const isTransientSocket = err?.code === 'P1017' ||
                    err?.code === 'P2028' ||
                    err?.message?.includes('closed the connection') ||
                    err?.message?.includes('10054') ||
                    err?.message?.includes('ConnectionReset') ||
                    err?.message?.includes('forcibly closed');
                if (attempt < 2 && isTransientSocket) {
                    console.warn(`[Prisma Transaction] Retrying transaction (attempt ${attempt + 1}) after transient connection reset...`);
                    await exports.prisma.$disconnect().catch(() => { });
                    await exports.prisma.$connect().catch(() => { });
                    continue;
                }
                throw err;
            }
        }
    }
    return originalTransaction(arg, options);
});
if (process.env.NODE_ENV !== 'production') {
    global.__tuition_prisma__ = exports.prisma;
}
exports.default = exports.prisma;
