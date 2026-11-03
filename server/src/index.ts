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
import { NotificationService } from './modules/notifications/notification.service.js';
import { demoModeMiddleware } from './middleware/demo-mode.middleware.js';
import { apiRateLimiter } from './middleware/rate-limiter.js';

const app = express();

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

app.use(express.json({ limit: '10mb' }));
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

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/institutes', institutesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/question-generator', questionGeneratorRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/staff-attendance', staffAttendanceRoutes);
app.use('/api/franchises', franchiseRoutes);

// Root info endpoint & health check redirects
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'digital-guru-franchise-api',
    status: 'running',
    health: '/api/health',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.redirect(307, '/api/health');
});

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const uptime = process.uptime();

  const responseStatus = dbHealth.connected ? 200 : 503;
  res.status(responseStatus).json({
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
  });
});

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

// Start server if run directly
const isMain = process.argv[1] && process.argv[1].endsWith('index.ts');
if (isMain || process.env.NODE_ENV === 'production') {
  validateProductionConfig();
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

export default app;

