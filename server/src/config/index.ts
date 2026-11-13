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
    // Canonical environment variable: PERSISTENT_VOLUME_PATH
    // Supported legacy aliases: PERSISTENT_STORAGE_PATH, STORAGE_PERSISTENT_PATH
    persistentVolumePath:
      process.env.PERSISTENT_VOLUME_PATH ||
      process.env.PERSISTENT_STORAGE_PATH ||
      process.env.STORAGE_PERSISTENT_PATH ||
      '',
    allowEphemeralLocal:
      process.env.ALLOW_EPHEMERAL_LOCAL_STORAGE === 'true' ||
      process.env.STORAGE_ALLOW_EPHEMERAL_LOCAL === 'true',
    s3: {
      bucket: process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '',
      region: process.env.S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@platform.local',
    defaultPassword: process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'AdminSecurePassword#2026',
    name: process.env.SUPER_ADMIN_NAME || 'Platform Administrator',
  },
};

/**
 * Validates storage driver configuration strictly across environments.
 * Prevents silent fallback to ephemeral storage in production and verifies directory permissions.
 */
export function validateStorageConfig(): {
  driver: 'local' | 'volume' | 's3';
  resolvedLocation: string;
  isWritable: boolean;
  statusMessage: string;
} {
  const driver = config.storage.driver;

  if (driver !== 'local' && driver !== 'volume' && driver !== 's3') {
    throw new Error(
      `[Storage Validation Failed]: Invalid STORAGE_DRIVER "${driver}". Allowed values are: local, volume, s3.`
    );
  }

  if (driver === 'volume') {
    const rawPath = config.storage.persistentVolumePath;
    if (!rawPath || !rawPath.trim()) {
      throw new Error(
        `[Storage Validation Failed]: STORAGE_DRIVER is set to "volume" but no persistent mount path was configured. ` +
        `Please set the canonical environment variable PERSISTENT_VOLUME_PATH to an absolute directory path. ` +
        `Refusing to silently fall back to local ephemeral storage.`
      );
    }

    const trimmedPath = rawPath.trim();
    if (!path.isAbsolute(trimmedPath)) {
      throw new Error(
        `[Storage Validation Failed]: PERSISTENT_VOLUME_PATH must be an absolute path (e.g. /mnt/persistent_storage or C:\\storage). ` +
        `Received relative path: "${trimmedPath}". Refusing silent fallback to local storage.`
      );
    }

    const resolved = path.resolve(trimmedPath);

    // Verify the persistent volume directory exists (fail-fast if volume is unmounted)
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `[Storage Validation Failed]: PERSISTENT_VOLUME_PATH directory "${resolved}" does not exist. ` +
        `Ensure the persistent storage volume is mounted and accessible before starting the server.`
      );
    }

    // Verify it is a directory
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        throw new Error(
          `[Storage Validation Failed]: PERSISTENT_VOLUME_PATH "${resolved}" exists but is not a directory.`
        );
      }
    } catch (err: any) {
      throw new Error(
        `[Storage Validation Failed]: Could not inspect PERSISTENT_VOLUME_PATH "${resolved}": ${err.message}`
      );
    }

    // Verify write permissions
    try {
      fs.accessSync(resolved, fs.constants.W_OK);
      const probeFile = path.join(resolved, `.probe-write-${Date.now()}-${process.pid}`);
      fs.writeFileSync(probeFile, 'storage-probe-ok');
      fs.unlinkSync(probeFile);
    } catch (err: any) {
      throw new Error(
        `[Storage Validation Failed]: PERSISTENT_VOLUME_PATH "${resolved}" is not writable: ${err.message}`
      );
    }

    return {
      driver: 'volume',
      resolvedLocation: resolved,
      isWritable: true,
      statusMessage: `Persistent volume verified and operational at ${resolved}`,
    };
  }

  if (driver === 's3') {
    const { bucket, accessKeyId, secretAccessKey, region, endpoint } = config.storage.s3;
    const missing: string[] = [];
    if (!bucket) missing.push('S3_BUCKET (or S3_BUCKET_NAME)');
    if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)');
    if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)');

    if (missing.length > 0) {
      throw new Error(
        `[Storage Validation Failed]: STORAGE_DRIVER is set to "s3" but missing required configuration: ${missing.join(', ')}. ` +
        `Refusing to start. S3 configuration must be complete; never silently write S3 uploads to local disk.`
      );
    }

    const endpointInfo = endpoint ? ` (endpoint: ${endpoint})` : '';
    return {
      driver: 's3',
      resolvedLocation: `s3://${bucket} [${region}]${endpointInfo}`,
      isWritable: true,
      statusMessage: `S3 storage configured for bucket "${bucket}" in region "${region}"`,
    };
  }

  // driver === 'local'
  if (config.nodeEnv === 'production' && !config.storage.allowEphemeralLocal) {
    throw new Error(
      `[Storage Validation Failed]: STORAGE_DRIVER is set to "local" in production without explicit ALLOW_EPHEMERAL_LOCAL_STORAGE=true. ` +
      `Local container storage is ephemeral and will lose uploaded course media on redeployment or restart. ` +
      `Configure STORAGE_DRIVER=volume with PERSISTENT_VOLUME_PATH=/path/to/volume, or STORAGE_DRIVER=s3 with credentials, ` +
      `or set ALLOW_EPHEMERAL_LOCAL_STORAGE=true to explicitly override.`
    );
  }

  const localResolved = path.resolve(process.cwd(), config.storage.localPath || './uploads');
  if (!fs.existsSync(localResolved)) {
    fs.mkdirSync(localResolved, { recursive: true });
  }

  return {
    driver: 'local',
    resolvedLocation: localResolved,
    isWritable: true,
    statusMessage: config.nodeEnv === 'production'
      ? `EPHEMERAL WARNING: Local storage active at ${localResolved} with ephemeral override`
      : `Local storage active at ${localResolved} (development mode)`,
  };
}

/**
 * Validates that critical secrets and storage are properly configured in production
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

    try {
      validateStorageConfig();
    } catch (storageErr: any) {
      errors.push(storageErr.message);
    }

    if (errors.length > 0) {
      throw new Error(`[Production Security Validation Failed]:\n- ${errors.join('\n- ')}`);
    }
  }
}
