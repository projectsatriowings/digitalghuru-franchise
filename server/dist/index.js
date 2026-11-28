"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./dns-preload.js");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const index_js_1 = require("./config/index.js");
const db_js_1 = require("./config/db.js");
const auth_routes_js_1 = __importDefault(require("./modules/auth/auth.routes.js"));
const institutes_routes_js_1 = __importDefault(require("./modules/institutes/institutes.routes.js"));
const staff_routes_js_1 = __importDefault(require("./modules/staff/staff.routes.js"));
const students_routes_js_1 = __importDefault(require("./modules/students/students.routes.js"));
const parents_routes_js_1 = __importDefault(require("./modules/parents/parents.routes.js"));
const academics_routes_js_1 = __importDefault(require("./modules/academics/academics.routes.js"));
const attendance_routes_js_1 = __importDefault(require("./modules/attendance/attendance.routes.js"));
const notifications_routes_js_1 = __importDefault(require("./modules/notifications/notifications.routes.js"));
const materials_routes_js_1 = __importDefault(require("./modules/materials/materials.routes.js"));
const homework_routes_js_1 = __importDefault(require("./modules/homework/homework.routes.js"));
const quiz_routes_js_1 = __importDefault(require("./modules/quiz/quiz.routes.js"));
const exams_routes_js_1 = __importDefault(require("./modules/exams/exams.routes.js"));
const progress_routes_js_1 = __importDefault(require("./modules/progress/progress.routes.js"));
const reviews_routes_js_1 = __importDefault(require("./modules/reviews/reviews.routes.js"));
const messaging_routes_js_1 = __importDefault(require("./modules/messaging/messaging.routes.js"));
const fees_routes_js_1 = __importDefault(require("./modules/fees/fees.routes.js"));
const question_generator_routes_js_1 = __importDefault(require("./modules/question-generator/question-generator.routes.js"));
const feedback_routes_js_1 = __importDefault(require("./modules/feedback/feedback.routes.js"));
const staff_attendance_routes_js_1 = __importDefault(require("./modules/staff-attendance/staff-attendance.routes.js"));
const franchise_routes_js_1 = __importDefault(require("./modules/franchise/franchise.routes.js"));
const courses_routes_js_1 = __importDefault(require("./modules/courses/courses.routes.js"));
const settlement_routes_js_1 = __importDefault(require("./modules/settlements/settlement.routes.js"));
const webhook_controller_js_1 = require("./modules/payments/webhook.controller.js");
const storage_js_1 = require("./utils/storage.js");
const courses_controller_js_1 = require("./modules/courses/courses.controller.js");
const auth_js_1 = require("./middleware/auth.js");
const notification_service_js_1 = require("./modules/notifications/notification.service.js");
const demo_mode_middleware_js_1 = require("./middleware/demo-mode.middleware.js");
const rate_limiter_js_1 = require("./middleware/rate-limiter.js");
const cache_js_1 = require("./utils/cache.js");
const app = (0, express_1.default)();
// Trust reverse proxy (Vercel Edge, AWS CloudFront, Docker) for secure IP and protocol detection
app.set('trust proxy', 1);
// Security & Performance Middlewares
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)({
    filter: (req, res) => {
        // Never compress range requests or binary file downloads (allows Chrome/PDF viewers to stream pages)
        if (req.headers.range) {
            return false;
        }
        if (req.path.includes('/download') || req.path.includes('/photo')) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
}));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // In development, allow localhost, local network, and non-browser clients (mobile apps, curl, server-to-server)
        if (!origin || index_js_1.config.nodeEnv !== 'production') {
            return callback(null, true);
        }
        // In production, validate against configured whitelist
        const allowedOrigins = index_js_1.config.corsOrigins.length > 0
            ? index_js_1.config.corsOrigins
            : ['https://franchise.digitalghuru.com', 'https://app.digitalghuru.com', 'https://digitalghuru.com', 'https://admin.digitalghuru.com'];
        if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app") || origin.includes("localhost")) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Skip high-frequency background polling from cluttering server logs
const SILENT_POLL_PATHS = new Set([
    '/api/notifications/unread-count',
    '/api/health',
]);
// Request performance timing & logging middleware
app.use((req, res, next) => {
    const start = performance.now();
    const originalEnd = res.end;
    res.end = function (chunk, encoding, callback) {
        const durationMs = (performance.now() - start).toFixed(1);
        if (!res.headersSent) {
            res.setHeader('X-Response-Time', `${durationMs}ms`);
        }
        if (!SILENT_POLL_PATHS.has(req.path)) {
            const timestamp = new Date().toISOString();
            const sanitizedUrl = (req.originalUrl || req.url).replace(/([?&](token|t|password|secret|accessToken|refreshToken|key|auth)=)[^&]+/gi, '$1[REDACTED]');
            console.log(`[${timestamp}] ${req.method} ${sanitizedUrl} ${res.statusCode} ${durationMs}ms`);
        }
        return originalEnd.call(this, chunk, encoding, callback);
    };
    next();
});
// Demo Mode Middleware (active when no DATABASE_URL configured)
app.use(demo_mode_middleware_js_1.demoModeMiddleware);
app.use('/api', rate_limiter_js_1.apiRateLimiter);
// Auto-invalidate short-TTL read cache on any data-mutating API request
app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.path.startsWith('/auth/login')) {
        res.on('finish', () => {
            if (res.statusCode < 400) {
                cache_js_1.serverCache.invalidate();
            }
        });
    }
    next();
});
// Public Verified Razorpay Webhook Endpoint (Bypasses user token auth, verified via HMAC signature)
app.post(['/api/webhooks/razorpay', '/webhooks/razorpay', '/api/fees/online/webhook', '/fees/online/webhook'], webhook_controller_js_1.handleRazorpayWebhook);
// Mount Routes (mounted on both /api/* and root /* to support all proxy/rewrite configurations)
const apiRoutesMap = [
    ['/auth', auth_routes_js_1.default],
    ['/institutes', institutes_routes_js_1.default],
    ['/staff', staff_routes_js_1.default],
    ['/students', students_routes_js_1.default],
    ['/parents', parents_routes_js_1.default],
    ['/academics', academics_routes_js_1.default],
    ['/attendance', attendance_routes_js_1.default],
    ['/notifications', notifications_routes_js_1.default],
    ['/materials', materials_routes_js_1.default],
    ['/homework', homework_routes_js_1.default],
    ['/quizzes', quiz_routes_js_1.default],
    ['/exams', exams_routes_js_1.default],
    ['/progress', progress_routes_js_1.default],
    ['/reviews', reviews_routes_js_1.default],
    ['/messaging', messaging_routes_js_1.default],
    ['/fees', fees_routes_js_1.default],
    ['/question-generator', question_generator_routes_js_1.default],
    ['/feedback', feedback_routes_js_1.default],
    ['/staff-attendance', staff_attendance_routes_js_1.default],
    ['/franchises', franchise_routes_js_1.default],
    ['/courses', courses_routes_js_1.default],
    ['/settlements', settlement_routes_js_1.default],
];
for (const [routePath, router] of apiRoutesMap) {
    app.use(`/api${routePath}`, router);
    app.use(routePath, router);
}
// Course media routes (direct file or scoped folder)
app.get(['/api/uploads/courses/:filename', '/uploads/courses/:filename'], async (req, res) => {
    try {
        const filename = req.params.filename;
        const result = await storage_js_1.StorageManager.findPublicMediaStream({
            filename,
            rangeHeader: req.headers.range,
        });
        if (!result) {
            return res.status(404).json({ success: false, message: 'Media not found' });
        }
        res.writeHead(result.statusCode, {
            'Content-Length': result.contentLength,
            'Content-Type': result.contentType,
            'Cache-Control': 'public, max-age=86400',
            'Accept-Ranges': result.acceptRanges,
            ...(result.contentRange ? { 'Content-Range': result.contentRange } : {}),
        });
        result.stream.pipe(res);
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Media stream error' });
    }
});
app.get(['/api/uploads/courses/:folder/:filename', '/uploads/courses/:folder/:filename'], async (req, res) => {
    const { folder, filename } = req.params;
    if ((0, storage_js_1.isPublicCourseFolder)(folder)) {
        return (0, courses_controller_js_1.streamPublicMedia)(req, res);
    }
    // If the folder parameter isn't a known public folder keyword, check if the file exists in any public course folder
    try {
        const fallbackPublic = await storage_js_1.StorageManager.findPublicMediaStream({
            filename,
            rangeHeader: req.headers.range,
        });
        if (fallbackPublic) {
            res.writeHead(fallbackPublic.statusCode, {
                'Content-Length': fallbackPublic.contentLength,
                'Content-Type': fallbackPublic.contentType,
                'Cache-Control': 'public, max-age=86400',
                'Accept-Ranges': fallbackPublic.acceptRanges,
                ...(fallbackPublic.contentRange ? { 'Content-Range': fallbackPublic.contentRange } : {}),
            });
            return fallbackPublic.stream.pipe(res);
        }
    }
    catch {
        // Fall through to protected authentication
    }
    return (0, auth_js_1.authenticateToken)(req, res, () => (0, courses_controller_js_1.streamProtectedMedia)(req, res));
});
// Root info endpoint
app.get(['/', '/api'], (_req, res) => {
    res.json({
        service: 'digital-guru-franchise-api',
        status: 'running',
        health: '/api/health',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Health check endpoint (serves both /api/health and /health)
const healthCheckHandler = async (_req, res) => {
    let dbHealth = {
        connected: false,
        latencyMs: undefined,
        error: undefined,
    };
    try {
        dbHealth = await (0, db_js_1.checkDatabaseHealth)();
    }
    catch (err) {
        dbHealth = { connected: false, latencyMs: undefined, error: err.message };
    }
    const uptime = process.uptime();
    res.status(200).json({
        status: dbHealth.connected ? 'healthy' : 'degraded',
        service: 'digital-guru-franchise-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(uptime),
        database: {
            provider: 'Neon PostgreSQL',
            connected: dbHealth.connected,
            latencyMs: dbHealth.latencyMs,
            ...(dbHealth.error && { error: dbHealth.error }),
        },
        storage: {
            driver: index_js_1.config.storage.driver,
            location: index_js_1.config.storage.driver === 's3'
                ? index_js_1.config.storage.s3.bucket
                : (index_js_1.config.storage.driver === 'volume' ? index_js_1.config.storage.persistentVolumePath : index_js_1.config.storage.localPath),
            operational: true,
        },
    });
};
app.get(['/api/health', '/health'], healthCheckHandler);
// Centralized 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString(),
    });
});
// Centralized error handler
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const message = index_js_1.config.nodeEnv === 'production' && status === 500
        ? 'Internal Server Error'
        : err.message || 'An unexpected error occurred';
    console.error(`[Error Handler] ${status} - ${err.message}`, err.stack);
    res.status(status).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
    });
});
// Start standalone server only when executed directly from CLI or PM2 (e.g. `node server/dist/index.js` or via PM2)
// Never start when loaded as a module in serverless functions (Vercel, AWS Lambda, tests, or wrappers)
const isDirectExecution = Boolean((Boolean(process.env.pm_id !== undefined || process.env.pm_exec_path) ||
    Boolean(process.argv[1] &&
        (process.argv[1].endsWith('index.ts') ||
            process.argv[1].endsWith('index.js')))) &&
    !process.env.VERCEL &&
    !process.env.AWS_LAMBDA_FUNCTION_NAME);
if (isDirectExecution) {
    (0, index_js_1.validateProductionConfig)();
    (0, storage_js_1.printStorageDiagnostics)();
    const server = app.listen(index_js_1.config.port, index_js_1.config.host, () => {
        console.log(`[Digital Ghuru Franchise API Server] listening on http://${index_js_1.config.host}:${index_js_1.config.port}`);
        console.log(`[Digital Ghuru Franchise API Server] Health check available at http://${index_js_1.config.host}:${index_js_1.config.port}/api/health`);
        notification_service_js_1.NotificationService.startWorker(15000);
    });
    const handleShutdown = () => {
        console.log('[Digital Ghuru Franchise API Server] Gracefully shutting down...');
        notification_service_js_1.NotificationService.stopWorker();
        server.close(() => {
            console.log('[Digital Ghuru Franchise API Server] Closed remaining connections.');
            process.exit(0);
        });
    };
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
}
app.default = app;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
    module.exports.default = app;
}
exports.default = app;
