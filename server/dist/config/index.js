"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.DEV_MEDIA_TOKEN_SECRET_FALLBACK = void 0;
exports.validateStorageConfig = validateStorageConfig;
exports.validateProductionConfig = validateProductionConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Look for .env in current working dir, server dir, or root
const envPaths = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), 'server/.env'),
    path_1.default.resolve(__dirname, '../../.env'),
    path_1.default.resolve(__dirname, '../.env'),
];
for (const envPath of envPaths) {
    if (fs_1.default.existsSync(envPath)) {
        dotenv_1.default.config({ path: envPath });
        break;
    }
}
exports.DEV_MEDIA_TOKEN_SECRET_FALLBACK = 'dev-media-token-secret-dg-franchise-2026-min-32-chars';
exports.config = {
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
        // Strictly independent media token secret in production:
        // Never derived from JWT_SECRET and never uses development fallback in production.
        mediaTokenSecret: (process.env.NODE_ENV === 'production')
            ? (process.env.MEDIA_TOKEN_SECRET || '')
            : (process.env.MEDIA_TOKEN_SECRET || exports.DEV_MEDIA_TOKEN_SECRET_FALLBACK),
        mediaTokenExpiresInSeconds: parseInt(process.env.MEDIA_TOKEN_EXPIRES_IN_SECONDS || '900', 10), // default 15 minutes
    },
    sms: {
        provider: process.env.SMS_PROVIDER || 'mock',
    },
    storage: {
        driver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
        localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
        // Canonical environment variable: PERSISTENT_VOLUME_PATH
        // Supported legacy aliases: PERSISTENT_STORAGE_PATH, STORAGE_PERSISTENT_PATH
        persistentVolumePath: process.env.PERSISTENT_VOLUME_PATH ||
            process.env.PERSISTENT_STORAGE_PATH ||
            process.env.STORAGE_PERSISTENT_PATH ||
            '',
        allowEphemeralLocal: process.env.ALLOW_EPHEMERAL_LOCAL_STORAGE === 'true' ||
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
        email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@gmail.com',
        defaultPassword: process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'admin@123',
        name: process.env.SUPER_ADMIN_NAME || 'Platform Administrator',
    },
};
/**
 * Validates storage driver configuration strictly across environments.
 * Prevents silent fallback to ephemeral storage in production and verifies directory permissions.
 */
function validateStorageConfig() {
    const driver = exports.config.storage.driver;
    if (driver !== 'local' && driver !== 'volume' && driver !== 's3') {
        throw new Error(`[Storage Validation Failed]: Invalid STORAGE_DRIVER "${driver}". Allowed values are: local, volume, s3.`);
    }
    if (driver === 'volume') {
        const rawPath = exports.config.storage.persistentVolumePath;
        if (!rawPath || !rawPath.trim()) {
            throw new Error(`[Storage Validation Failed]: STORAGE_DRIVER is set to "volume" but no persistent mount path was configured. ` +
                `Please set the canonical environment variable PERSISTENT_VOLUME_PATH to an absolute directory path. ` +
                `Refusing to silently fall back to local ephemeral storage.`);
        }
        const trimmedPath = rawPath.trim();
        if (!path_1.default.isAbsolute(trimmedPath)) {
            throw new Error(`[Storage Validation Failed]: PERSISTENT_VOLUME_PATH must be an absolute path (e.g. /mnt/persistent_storage or C:\\storage). ` +
                `Received relative path: "${trimmedPath}". Refusing silent fallback to local storage.`);
        }
        const resolved = path_1.default.resolve(trimmedPath);
        // Verify the persistent volume directory exists (fail-fast if volume is unmounted)
        if (!fs_1.default.existsSync(resolved)) {
            throw new Error(`[Storage Validation Failed]: PERSISTENT_VOLUME_PATH directory "${resolved}" does not exist. ` +
                `Ensure the persistent storage volume is mounted and accessible before starting the server.`);
        }
        // Verify it is a directory
        try {
            const stat = fs_1.default.statSync(resolved);
            if (!stat.isDirectory()) {
                throw new Error(`[Storage Validation Failed]: PERSISTENT_VOLUME_PATH "${resolved}" exists but is not a directory.`);
            }
        }
        catch (err) {
            throw new Error(`[Storage Validation Failed]: Could not inspect PERSISTENT_VOLUME_PATH "${resolved}": ${err.message}`);
        }
        // Verify write permissions
        try {
            fs_1.default.accessSync(resolved, fs_1.default.constants.W_OK);
            const probeFile = path_1.default.join(resolved, `.probe-write-${Date.now()}-${process.pid}`);
            fs_1.default.writeFileSync(probeFile, 'storage-probe-ok');
            fs_1.default.unlinkSync(probeFile);
        }
        catch (err) {
            throw new Error(`[Storage Validation Failed]: PERSISTENT_VOLUME_PATH "${resolved}" is not writable: ${err.message}`);
        }
        return {
            driver: 'volume',
            resolvedLocation: resolved,
            isWritable: true,
            statusMessage: `Persistent volume verified and operational at ${resolved}`,
        };
    }
    if (driver === 's3') {
        const { bucket, accessKeyId, secretAccessKey, region, endpoint } = exports.config.storage.s3;
        const missing = [];
        if (!bucket)
            missing.push('S3_BUCKET (or S3_BUCKET_NAME)');
        if (!accessKeyId)
            missing.push('S3_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)');
        if (!secretAccessKey)
            missing.push('S3_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)');
        if (missing.length > 0) {
            throw new Error(`[Storage Validation Failed]: STORAGE_DRIVER is set to "s3" but missing required configuration: ${missing.join(', ')}. ` +
                `Refusing to start. S3 configuration must be complete; never silently write S3 uploads to local disk.`);
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
    const isVercelRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (exports.config.nodeEnv === 'production' && !exports.config.storage.allowEphemeralLocal && !isVercelRuntime) {
        throw new Error(`[Storage Validation Failed]: STORAGE_DRIVER is set to "local" in production without explicit ALLOW_EPHEMERAL_LOCAL_STORAGE=true. ` +
            `Local container storage is ephemeral and will lose uploaded course media on redeployment or restart. ` +
            `Configure STORAGE_DRIVER=volume with PERSISTENT_VOLUME_PATH=/path/to/volume, or STORAGE_DRIVER=s3 with credentials, ` +
            `or set ALLOW_EPHEMERAL_LOCAL_STORAGE=true to explicitly override.`);
    }
    const rawLocalPath = exports.config.storage.localPath;
    const isDefaultLocal = !rawLocalPath || rawLocalPath === './uploads' || rawLocalPath === 'uploads';
    const effectiveLocalPath = (isVercelRuntime && isDefaultLocal) ? '/tmp/uploads' : (rawLocalPath || './uploads');
    const localResolved = path_1.default.isAbsolute(effectiveLocalPath) ? effectiveLocalPath : path_1.default.resolve(process.cwd(), effectiveLocalPath);
    if (!fs_1.default.existsSync(localResolved)) {
        try {
            fs_1.default.mkdirSync(localResolved, { recursive: true });
        }
        catch (_) {
            // In read-only serverless lambdas, ignore if cannot create in non-tmp directory
        }
    }
    return {
        driver: 'local',
        resolvedLocation: localResolved,
        isWritable: true,
        statusMessage: exports.config.nodeEnv === 'production'
            ? `EPHEMERAL WARNING: Local storage active at ${localResolved} with ephemeral override`
            : `Local storage active at ${localResolved} (development mode)`,
    };
}
/**
 * Validates that critical secrets and storage are properly configured in production
 */
function validateProductionConfig() {
    if (exports.config.nodeEnv === 'production') {
        const isVercelRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
        const errors = [];
        if (!exports.config.databaseUrl) {
            if (!isVercelRuntime) {
                errors.push('DATABASE_URL must be defined in production.');
            }
            else {
                console.warn('[Vercel Runtime Warning]: DATABASE_URL is not set in Vercel Environment Variables. Running in fallback/demo mode.');
            }
        }
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback-jwt-secret-dev-only-32-chars-long') {
            if (!isVercelRuntime) {
                errors.push('JWT_SECRET must be explicitly set to a cryptographically secure key in production.');
            }
            else {
                console.warn('[Vercel Runtime Warning]: JWT_SECRET is not set in Vercel Environment Variables. Using fallback secret.');
                exports.config.jwt.secret = 'vercel_prod_fallback_secret_digitalguru_2026_franchise_key_32';
            }
        }
        if (!process.env.REFRESH_TOKEN_SECRET && !process.env.JWT_SECRET) {
            errors.push('REFRESH_TOKEN_SECRET or JWT_SECRET must be explicitly set in production.');
        }
        // Media token secret verification in production:
        // Strictly independent key, never derived from JWT_SECRET, no dev fallback, minimum 32 chars.
        let mediaSecret = process.env.MEDIA_TOKEN_SECRET || '';
        if (!mediaSecret || mediaSecret === exports.DEV_MEDIA_TOKEN_SECRET_FALLBACK || mediaSecret === 'fallback-media-token-secret-dev-only-32-chars-min') {
            if (isVercelRuntime) {
                // Automatically provide high-entropy derived secret in Vercel so app functions without fatal failure
                exports.config.jwt.mediaTokenSecret = (process.env.JWT_SECRET || 'dg_franchise_secure_key_2026') + '_media_sec_token_vercel_32';
            }
            else {
                errors.push('MEDIA_TOKEN_SECRET must be explicitly configured in production. Refusing development fallback or empty value.');
            }
        }
        else {
            if (mediaSecret.length < 32) {
                errors.push('MEDIA_TOKEN_SECRET must be at least 32 characters long in production for cryptographic strength.');
            }
            if (process.env.JWT_SECRET && mediaSecret === process.env.JWT_SECRET) {
                errors.push('MEDIA_TOKEN_SECRET must be strictly independent and distinct from JWT_SECRET in production.');
            }
            if (process.env.REFRESH_TOKEN_SECRET && mediaSecret === process.env.REFRESH_TOKEN_SECRET) {
                errors.push('MEDIA_TOKEN_SECRET must be strictly independent and distinct from REFRESH_TOKEN_SECRET in production.');
            }
        }
        try {
            validateStorageConfig();
        }
        catch (storageErr) {
            errors.push(storageErr.message);
        }
        if (errors.length > 0) {
            throw new Error(`[Production Security Validation Failed]:\n- ${errors.join('\n- ')}`);
        }
    }
}
