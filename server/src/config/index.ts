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
    driver: (process.env.STORAGE_DRIVER || 'local').toLowerCase() as 'local' | 'volume' | 's3',
    localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
    persistentVolumePath: process.env.PERSISTENT_STORAGE_PATH || process.env.STORAGE_PERSISTENT_PATH || '',
    allowEphemeralLocal: process.env.STORAGE_ALLOW_EPHEMERAL_LOCAL === 'true',
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
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

    // Storage persistence validation in production
    if (config.storage.driver === 'local') {
      if (!config.storage.allowEphemeralLocal && !config.storage.persistentVolumePath) {
        errors.push(
          'STORAGE_DRIVER is set to "local" in production without a persistent volume mount. ' +
          'Local container storage is ephemeral and will lose uploaded course media on redeployment or restart. ' +
          'Please configure a persistent mounted volume (STORAGE_DRIVER=volume and PERSISTENT_STORAGE_PATH=/path/to/volume) ' +
          'or object storage (STORAGE_DRIVER=s3 with credentials), or set STORAGE_ALLOW_EPHEMERAL_LOCAL=true to explicitly override.'
        );
      }
    } else if (config.storage.driver === 'volume') {
      const mountPath = config.storage.persistentVolumePath || config.storage.localPath;
      if (!mountPath) {
        errors.push('STORAGE_DRIVER is set to "volume" but PERSISTENT_STORAGE_PATH is not configured.');
      }
    } else if (config.storage.driver === 's3') {
      if (!config.storage.s3.bucket) errors.push('S3_BUCKET must be defined when STORAGE_DRIVER=s3.');
      if (!config.storage.s3.accessKeyId) errors.push('S3_ACCESS_KEY_ID must be defined when STORAGE_DRIVER=s3.');
      if (!config.storage.s3.secretAccessKey) errors.push('S3_SECRET_ACCESS_KEY must be defined when STORAGE_DRIVER=s3.');
    }

    if (errors.length > 0) {
      throw new Error(`[Production Security Validation Failed]:\n- ${errors.join('\n- ')}`);
    }
  }
}
