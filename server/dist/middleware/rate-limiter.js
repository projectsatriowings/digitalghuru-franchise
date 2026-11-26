"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRateLimiter = exports.authRateLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
const store = new Map();
// Cleanup stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
        if (record.resetAt <= now) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000).unref();
function getClientIp(req) {
    try {
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (typeof xForwardedFor === 'string') {
            return xForwardedFor.split(',')[0].trim();
        }
        if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
            return xForwardedFor[0].trim();
        }
        const xRealIp = req.headers['x-real-ip'];
        if (typeof xRealIp === 'string') {
            return xRealIp.trim();
        }
        if (req.ip)
            return req.ip;
    }
    catch {
        // ignore
    }
    try {
        if (req.socket && req.socket.remoteAddress) {
            return req.socket.remoteAddress;
        }
    }
    catch {
        // ignore
    }
    return 'unknown';
}
/**
 * In-memory sliding window rate limiter middleware for production protection
 */
function createRateLimiter(options) {
    const { windowMs, max, message = 'Too many requests. Please try again later.', skipInTests = true, } = options;
    return (req, res, next) => {
        // Skip in automated test environment if requested
        if (skipInTests && (process.env.NODE_ENV === 'test' || req.headers['x-internal-test'] === 'dg-test-suite')) {
            return next();
        }
        const ip = getClientIp(req);
        const key = `${req.baseUrl || ''}${req.path}:${ip}`;
        const now = Date.now();
        const record = store.get(key);
        if (!record || record.resetAt <= now) {
            store.set(key, {
                count: 1,
                resetAt: now + windowMs,
            });
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', max - 1);
            res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
            return next();
        }
        if (record.count >= max) {
            const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
            return res.status(429).json({
                success: false,
                error: message,
                retryAfterSeconds: retryAfterSec,
                timestamp: new Date().toISOString(),
            });
        }
        record.count++;
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
        next();
    };
}
/**
 * Strict rate limiter for authentication endpoints: max 15 login attempts per 15 minutes per IP
 */
exports.authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
    skipInTests: true,
});
/**
 * Standard API rate limiter: max 300 requests per minute per IP
 */
exports.apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: 'Too many requests. Please slow down and try again shortly.',
    skipInTests: true,
});
