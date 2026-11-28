import './dns-preload.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, validateProductionConfig } from './config/index.js';
import { checkDatabaseHealth } from './config/db.js';

import authRoutes from './modules/auth/auth.routes.js';
import institutesRoutes from './modules/institutes/institutes.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import studentsRoutes from './modules/students/students.routes.js';
import parentsRoutes from './modules/parents/parents.routes.js';
import academicsRoutes from './modules/academics/academics.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import materialsRoutes from './modules/materials/materials.routes.js';
import homeworkRoutes from './modules/homework/homework.routes.js';
import quizRoutes from './modules/quiz/quiz.routes.js';
import examsRoutes from './modules/exams/exams.routes.js';
import progressRoutes from './modules/progress/progress.routes.js';
import reviewsRoutes from './modules/reviews/reviews.routes.js';
import messagingRoutes from './modules/messaging/messaging.routes.js';
import feesRoutes from './modules/fees/fees.routes.js';
import questionGeneratorRoutes from './modules/question-generator/question-generator.routes.js';
import feedbackRoutes from './modules/feedback/feedback.routes.js';
import staffAttendanceRoutes from './modules/staff-attendance/staff-attendance.routes.js';
import franchiseRoutes from './modules/franchise/franchise.routes.js';
import coursesRoutes from './modules/courses/courses.routes.js';
import settlementRoutes from './modules/settlements/settlement.routes.js';
import { handleRazorpayWebhook } from './modules/payments/webhook.controller.js';
import { isPublicCourseFolder, printStorageDiagnostics, StorageManager } from './utils/storage.js';
import { streamPublicMedia, streamProtectedMedia } from './modules/courses/courses.controller.js';
import { authenticateToken } from './middleware/auth.js';
import { NotificationService } from './modules/notifications/notification.service.js';
import { demoModeMiddleware } from './middleware/demo-mode.middleware.js';
import { apiRateLimiter } from './middleware/rate-limiter.js';
import { serverCache } from './utils/cache.js';

const app = express();

// Trust reverse proxy (Vercel Edge, AWS CloudFront, Docker) for secure IP and protocol detection
app.set('trust proxy', 1);

// Security & Performance Middlewares
app.use(helmet());
app.use(
  compression({
    filter: (req: Request, res: Response) => {
      // Never compress range requests or binary file downloads (allows Chrome/PDF viewers to stream pages)
      if (req.headers.range) {
        return false;
      }
      if (req.path.includes('/download') || req.path.includes('/photo')) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
app.use(
  cors({
    origin: (origin: any, callback: any) => {
      // In development, allow localhost, local network, and non-browser clients (mobile apps, curl, server-to-server)
      if (!origin || config.nodeEnv !== 'production') {
        return callback(null, true);
      }
      // In production, validate against configured whitelist
      const allowedOrigins = config.corsOrigins.length > 0
        ? config.corsOrigins
        : ['https://franchise.digitalghuru.com', 'https://app.digitalghuru.com', 'https://digitalghuru.com', 'https://admin.digitalghuru.com'];
      if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app") || origin.includes("localhost")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Skip high-frequency background polling from cluttering server logs
const SILENT_POLL_PATHS = new Set([
  '/api/notifications/unread-count',
  '/api/health',
]);

// Request performance timing & logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  const originalEnd = res.end;
  (res as any).end = function (chunk?: any, encoding?: any, callback?: any) {
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
app.use(demoModeMiddleware);
app.use('/api', apiRateLimiter);

// Auto-invalidate short-TTL read cache on any data-mutating API request
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.path.startsWith('/auth/login')) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        serverCache.invalidate();
      }
    });
  }
  next();
});

// Public Verified Razorpay Webhook Endpoint (Bypasses user token auth, verified via HMAC signature)
app.post(
  ['/api/webhooks/razorpay', '/webhooks/razorpay', '/api/fees/online/webhook', '/fees/online/webhook'],
  handleRazorpayWebhook
);

// Mount Routes (mounted on both /api/* and root /* to support all proxy/rewrite configurations)
const apiRoutesMap: [string, any][] = [
  ['/auth', authRoutes],
  ['/institutes', institutesRoutes],
  ['/staff', staffRoutes],
  ['/students', studentsRoutes],
  ['/parents', parentsRoutes],
  ['/academics', academicsRoutes],
  ['/attendance', attendanceRoutes],
  ['/notifications', notificationsRoutes],
  ['/materials', materialsRoutes],
  ['/homework', homeworkRoutes],
  ['/quizzes', quizRoutes],
  ['/exams', examsRoutes],
  ['/progress', progressRoutes],
  ['/reviews', reviewsRoutes],
  ['/messaging', messagingRoutes],
  ['/fees', feesRoutes],
  ['/question-generator', questionGeneratorRoutes],
  ['/feedback', feedbackRoutes],
  ['/staff-attendance', staffAttendanceRoutes],
  ['/franchises', franchiseRoutes],
  ['/courses', coursesRoutes],
  ['/settlements', settlementRoutes],
];

for (const [routePath, router] of apiRoutesMap) {
  app.use(`/api${routePath}`, router);
  app.use(routePath, router);
}

// Course media routes (direct file or scoped folder)
app.get(['/api/uploads/courses/:filename', '/uploads/courses/:filename'], async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const result = await StorageManager.findPublicMediaStream({
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
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Media stream error' });
  }
});

app.get(['/api/uploads/courses/:folder/:filename', '/uploads/courses/:folder/:filename'], async (req: Request, res: Response) => {
  const { folder, filename } = req.params;
  if (isPublicCourseFolder(folder)) {
    return streamPublicMedia(req, res);
  }
  // If the folder parameter isn't a known public folder keyword, check if the file exists in any public course folder
  try {
    const fallbackPublic = await StorageManager.findPublicMediaStream({
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
  } catch {
    // Fall through to protected authentication
  }
  return authenticateToken(req as any, res, () => streamProtectedMedia(req, res));
});

// Root info endpoint
app.get(['/', '/api'], (_req: Request, res: Response) => {
  res.json({
    service: 'digital-guru-franchise-api',
    status: 'running',
    health: '/api/health',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint (serves both /api/health and /health)
const healthCheckHandler = async (_req: Request, res: Response) => {
  let dbHealth: { connected: boolean; latencyMs?: number; error?: string } = {
    connected: false,
    latencyMs: undefined,
    error: undefined,
  };
  try {
    dbHealth = await checkDatabaseHealth();
  } catch (err: any) {
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
      driver: config.storage.driver,
      location: config.storage.driver === 's3'
        ? config.storage.s3.bucket
        : (config.storage.driver === 'volume' ? config.storage.persistentVolumePath : config.storage.localPath),
      operational: true,
    },
  });
};

app.get(['/api/health', '/health'], healthCheckHandler);

// Centralized 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  const message = config.nodeEnv === 'production' && status === 500
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
const isDirectExecution = Boolean(
  (
    Boolean(process.env.pm_id !== undefined || process.env.pm_exec_path) ||
    Boolean(
      process.argv[1] &&
      (
        process.argv[1].endsWith('index.ts') ||
        process.argv[1].endsWith('index.js')
      )
    )
  ) &&
  !process.env.VERCEL &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME
);

if (isDirectExecution) {
  validateProductionConfig();
  printStorageDiagnostics();
  const server = app.listen(config.port, config.host, () => {
    console.log(`[Digital Guru Franchise API Server] listening on http://${config.host}:${config.port}`);
    console.log(`[Digital Guru Franchise API Server] Health check available at http://${config.host}:${config.port}/api/health`);
    NotificationService.startWorker(15000);
  });

  const handleShutdown = () => {
    console.log('[Digital Guru Franchise API Server] Gracefully shutting down...');
    NotificationService.stopWorker();
    server.close(() => {
      console.log('[Digital Guru Franchise API Server] Closed remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

(app as any).default = app;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  (module.exports as any).default = app;
}
export default app;

