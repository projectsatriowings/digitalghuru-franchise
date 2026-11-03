import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';

// Look for .env in current working dir, server dir, or root
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000/api',
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-jwt-secret-dev-only-32-chars-long',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}_refresh` : 'fallback-refresh-secret-dev-only-32'),
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'mock',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@platform.local',
    defaultPassword: process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'AdminSecurePassword#2026',
    name: process.env.SUPER_ADMIN_NAME || 'Platform Administrator',
  },
};

/**
 * Validates that critical secrets are properly configured in production
 */
export function validateProductionConfig() {
  if (config.nodeEnv === 'production') {
    const errors: string[] = [];
    if (!config.databaseUrl) {
      errors.push('DATABASE_URL must be defined in production.');
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback-jwt-secret-dev-only-32-chars-long') {
      errors.push('JWT_SECRET must be explicitly set to a cryptographically secure key in production.');
    }
    if (!process.env.REFRESH_TOKEN_SECRET && !process.env.JWT_SECRET) {
      errors.push('REFRESH_TOKEN_SECRET or JWT_SECRET must be explicitly set in production.');
    }
    if (errors.length > 0) {
      throw new Error(`[Production Security Validation Failed]:\n- ${errors.join('\n- ')}`);
    }
  }
}
