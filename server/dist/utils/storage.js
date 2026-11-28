"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseMediaUpload = exports.photoUpload = exports.fileUpload = exports.MAX_COURSE_FILE_SIZE_BYTES = exports.ALLOWED_COURSE_MIME_TYPES = exports.MAX_PHOTO_SIZE_BYTES = exports.ALLOWED_PHOTO_MIME_TYPES = exports.MAX_FILE_SIZE_BYTES = exports.ALLOWED_MIME_TYPES = exports.StorageManager = exports.s3StorageManager = exports.S3StorageManager = exports.PROTECTED_COURSE_FOLDERS = exports.PUBLIC_COURSE_FOLDERS = void 0;
exports.isPublicCourseFolder = isPublicCourseFolder;
exports.isProtectedCourseFolder = isProtectedCourseFolder;
exports.getActiveStorageDir = getActiveStorageDir;
exports.initDiskStorageDirectories = initDiskStorageDirectories;
exports.printStorageDiagnostics = printStorageDiagnostics;
exports.parseHttpRange = parseHttpRange;
exports.sanitizeFilename = sanitizeFilename;
exports.resolveAbsolutePath = resolveAbsolutePath;
exports.getRelativeStorageKey = getRelativeStorageKey;
exports.getMimeType = getMimeType;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
const index_js_1 = require("../config/index.js");
// -------------------------------------------------------------
// FOLDER PARTITIONS & SCOPES (STRICT ISOLATION)
// -------------------------------------------------------------
exports.PUBLIC_COURSE_FOLDERS = [
    'thumbnails',
    'banners',
    'brochures',
    'public',
    'promotional',
    'marketing',
];
exports.PROTECTED_COURSE_FOLDERS = [
    'attachments',
    'videos',
    'lessons',
    'materials',
    'worksheets',
    'protected',
    'resources',
    'general',
];
function isPublicCourseFolder(folder) {
    if (!folder)
        return false;
    return exports.PUBLIC_COURSE_FOLDERS.includes(folder.trim().toLowerCase());
}
function isProtectedCourseFolder(folder) {
    if (!folder)
        return false;
    return exports.PROTECTED_COURSE_FOLDERS.includes(folder.trim().toLowerCase());
}
// -------------------------------------------------------------
// ACTIVE STORAGE DIRECTORY RESOLUTION
// -------------------------------------------------------------
/**
 * Resolves the active base directory for local or persistent volume storage.
 * In volume mode, strictly requires PERSISTENT_VOLUME_PATH and rejects silent local fallbacks.
 * In S3 mode, throws because S3 does not use a local directory.
 */
function getActiveStorageDir() {
    if (index_js_1.config.storage.driver === 'volume') {
        if (!index_js_1.config.storage.persistentVolumePath || !index_js_1.config.storage.persistentVolumePath.trim()) {
            throw new Error('[Storage Configuration Error]: STORAGE_DRIVER is set to "volume" but PERSISTENT_VOLUME_PATH is not configured. ' +
                'Refusing to silently fall back to local ephemeral storage.');
        }
        return path_1.default.resolve(index_js_1.config.storage.persistentVolumePath.trim());
    }
    if (index_js_1.config.storage.driver === 's3') {
        throw new Error('[Storage Configuration Error]: getActiveStorageDir() invoked while STORAGE_DRIVER="s3". S3 storage uses object keys, not local filesystem paths.');
    }
    const configuredLocal = index_js_1.config.storage.localPath || './uploads';
    if (path_1.default.isAbsolute(configuredLocal)) {
        return configuredLocal;
    }
    const rootCandidate = path_1.default.resolve(process.cwd(), configuredLocal);
    const serverCandidate = path_1.default.resolve(process.cwd(), 'server', configuredLocal);
    // If cwd is repo root and root uploads is missing/empty, use server/uploads if available
    if ((!fs_1.default.existsSync(rootCandidate) || !fs_1.default.existsSync(path_1.default.join(rootCandidate, 'courses'))) &&
        fs_1.default.existsSync(serverCandidate) &&
        fs_1.default.existsSync(path_1.default.join(serverCandidate, 'courses'))) {
        return serverCandidate;
    }
    return rootCandidate;
}
/**
 * Initializes required folder partitions on disk for local and volume drivers.
 */
function initDiskStorageDirectories() {
    if (index_js_1.config.storage.driver === 's3')
        return;
    const baseDir = getActiveStorageDir();
    if (!fs_1.default.existsSync(baseDir)) {
        fs_1.default.mkdirSync(baseDir, { recursive: true });
    }
    for (const folder of exports.PUBLIC_COURSE_FOLDERS) {
        const dir = path_1.default.join(baseDir, 'courses', 'public', folder);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    }
    for (const folder of exports.PROTECTED_COURSE_FOLDERS) {
        const dir = path_1.default.join(baseDir, 'courses', 'protected', folder);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
// Initialize directories if local/volume configured safely
try {
    if (index_js_1.config.storage.driver !== 's3') {
        initDiskStorageDirectories();
    }
}
catch {
    // Postpone startup failures to explicit validateStorageConfig() invocation
}
// -------------------------------------------------------------
// STARTUP DIAGNOSTICS
// -------------------------------------------------------------
function printStorageDiagnostics() {
    try {
        const validation = (0, index_js_1.validateStorageConfig)();
        console.log('------------------------------------------------------------');
        console.log('[Storage Diagnostics]');
        console.log(`  Driver:              ${validation.driver.toUpperCase()}`);
        console.log(`  Resolved Location:   ${validation.resolvedLocation}`);
        console.log(`  Health Status:       ${validation.statusMessage}`);
        if (index_js_1.config.storage.driver === 'volume') {
            const canonicalEnv = process.env.PERSISTENT_VOLUME_PATH
                ? 'PERSISTENT_VOLUME_PATH'
                : process.env.PERSISTENT_STORAGE_PATH
                    ? 'PERSISTENT_STORAGE_PATH (legacy alias)'
                    : process.env.STORAGE_PERSISTENT_PATH
                        ? 'STORAGE_PERSISTENT_PATH (legacy alias)'
                        : 'none';
            console.log(`  Configuration Key:   ${canonicalEnv}`);
        }
        console.log('------------------------------------------------------------');
    }
    catch (err) {
        console.error('------------------------------------------------------------');
        console.error('[Storage Diagnostics CRITICAL FAILURE]');
        console.error(`  ${err.message}`);
        console.error('------------------------------------------------------------');
        throw err;
    }
}
/**
 * Parses HTTP Range headers in compliance with RFC 7233:
 * - Closed range: bytes=0-1023
 * - Prefix range: bytes=1024- (from 1024 to EOF)
 * - Suffix range: bytes=-500 (last 500 bytes of file)
 * Throws { statusCode: 416, totalSize } for unsatisfiable or malformed ranges.
 * Empty files (totalSize === 0) cannot satisfy any byte-range request.
 */
function parseHttpRange(rangeHeader, totalSize) {
    if (!rangeHeader || !rangeHeader.startsWith('bytes='))
        return null;
    // Empty file: No byte range is satisfiable (RFC 7233 Section 4.4)
    if (totalSize <= 0) {
        throw { statusCode: 416, totalSize: 0 };
    }
    const rangeSpec = rangeHeader.replace(/^bytes=/, '').trim();
    if (!rangeSpec || rangeSpec.includes(',')) {
        throw { statusCode: 416, totalSize };
    }
    // Strict regex: must contain only digits or empty on either side of single hyphen.
    // Strictly rejects partial non-numeric strings like "12abc-34", negative signs, or decimals.
    const match = rangeSpec.match(/^(\d*)-(\d*)$/);
    if (!match) {
        throw { statusCode: 416, totalSize };
    }
    const [, startStr, endStr] = match;
    if (!startStr && !endStr) {
        throw { statusCode: 416, totalSize };
    }
    let start;
    let end;
    if (!startStr) {
        // Suffix range: bytes=-500 (last 500 bytes)
        const suffix = parseInt(endStr, 10);
        if (suffix <= 0)
            throw { statusCode: 416, totalSize };
        start = Math.max(0, totalSize - suffix);
        end = totalSize - 1;
    }
    else if (!endStr) {
        // Prefix range: bytes=1024- (from 1024 to EOF)
        start = parseInt(startStr, 10);
        if (start >= totalSize)
            throw { statusCode: 416, totalSize };
        end = totalSize - 1;
    }
    else {
        // Closed range: bytes=0-1023
        start = parseInt(startStr, 10);
        end = parseInt(endStr, 10);
        if (start > end || start >= totalSize) {
            throw { statusCode: 416, totalSize };
        }
        end = Math.min(end, totalSize - 1);
    }
    return { start, end };
}
// -------------------------------------------------------------
// S3 OBJECT STORAGE MANAGER
// -------------------------------------------------------------
class S3StorageManager {
    client = null;
    getClient() {
        if (!this.client) {
            const { bucket, region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = index_js_1.config.storage.s3;
            if (!bucket || !accessKeyId || !secretAccessKey) {
                throw new Error('[S3 Storage Error]: S3 client accessed without complete credentials. ' +
                    'Configure S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
            }
            this.client = new client_s3_1.S3Client({
                region,
                ...(endpoint ? { endpoint } : {}),
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
                forcePathStyle: Boolean(forcePathStyle || endpoint),
            });
        }
        return this.client;
    }
    /**
     * Memory-safe streaming upload directly to S3 via @aws-sdk/lib-storage Upload.
     * Chunks are streamed in 5MB parts without buffering the whole file in application memory.
     * Incomplete multipart uploads are automatically aborted on failure.
     */
    async uploadStream(options) {
        const client = this.getClient();
        let bytesUploaded = 0;
        options.stream.on('data', (chunk) => {
            bytesUploaded += chunk.length;
        });
        const upload = new lib_storage_1.Upload({
            client,
            params: {
                Bucket: index_js_1.config.storage.s3.bucket,
                Key: options.key,
                Body: options.stream,
                ContentType: options.contentType,
                Metadata: options.metadata,
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024, // 5MB part size
            leavePartsOnError: false, // Automatically abort incomplete multipart uploads
        });
        await upload.done();
        return { key: options.key, size: bytesUploaded };
    }
    async uploadFile(options) {
        const client = this.getClient();
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: index_js_1.config.storage.s3.bucket,
            Key: options.key,
            Body: options.buffer,
            ContentType: options.contentType,
            Metadata: options.metadata,
        }));
        return { key: options.key, size: options.buffer.length };
    }
    async getObjectStream(key, range) {
        const client = this.getClient();
        try {
            let rangeHeaderToSend = range;
            if (range) {
                try {
                    const head = await client.send(new client_s3_1.HeadObjectCommand({
                        Bucket: index_js_1.config.storage.s3.bucket,
                        Key: key,
                    }));
                    const totalSize = head.ContentLength || 0;
                    const parsedRange = parseHttpRange(range, totalSize);
                    if (parsedRange) {
                        rangeHeaderToSend = `bytes=${parsedRange.start}-${parsedRange.end}`;
                    }
                }
                catch (headErr) {
                    if (headErr.statusCode === 416)
                        throw headErr;
                }
            }
            const response = await client.send(new client_s3_1.GetObjectCommand({
                Bucket: index_js_1.config.storage.s3.bucket,
                Key: key,
                ...(rangeHeaderToSend ? { Range: rangeHeaderToSend } : {}),
            }));
            const stream = response.Body;
            const statusCode = rangeHeaderToSend && response.ContentRange ? 206 : 200;
            const contentLength = response.ContentLength || 0;
            const contentType = response.ContentType || getMimeType(path_1.default.extname(key));
            const contentRange = response.ContentRange;
            return {
                stream,
                statusCode,
                contentType,
                contentLength,
                contentRange,
            };
        }
        catch (err) {
            if (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                return null;
            }
            if (err.name === 'InvalidRange' || err.$metadata?.httpStatusCode === 416 || err.statusCode === 416) {
                throw { statusCode: 416, totalSize: err.totalSize, message: 'Requested range not satisfiable' };
            }
            console.error(`[S3 Storage Error] Failed to stream object ${key}:`, err.message);
            throw err;
        }
    }
    async objectExists(key) {
        const client = this.getClient();
        try {
            await client.send(new client_s3_1.HeadObjectCommand({
                Bucket: index_js_1.config.storage.s3.bucket,
                Key: key,
            }));
            return true;
        }
        catch (err) {
            if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                return false;
            }
            return false;
        }
    }
    async deleteObject(key) {
        const client = this.getClient();
        try {
            await client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: index_js_1.config.storage.s3.bucket,
                Key: key,
            }));
            return true;
        }
        catch (err) {
            console.error(`[S3 Storage Error] Failed to delete object ${key}:`, err.message);
            return false;
        }
    }
}
exports.S3StorageManager = S3StorageManager;
exports.s3StorageManager = new S3StorageManager();
// -------------------------------------------------------------
// UNIFIED STORAGE MANAGER (STRICT SCOPED ISOLATION)
// -------------------------------------------------------------
exports.StorageManager = {
    validate: index_js_1.validateStorageConfig,
    printDiagnostics: printStorageDiagnostics,
    async getMediaStream(options) {
        const { scope, folder, filename, rangeHeader } = options;
        if (!folder || !filename)
            return null;
        // Strict rejection of path traversal
        if (filename.includes('..') ||
            filename.includes('/') ||
            filename.includes('\\') ||
            filename.includes('%2e') ||
            filename.includes('%2E')) {
            return null;
        }
        const sanitizedFolder = folder.trim().toLowerCase();
        const sanitizedFilename = sanitizeFilename(filename);
        // Strict scope validation: public cannot access protected folders and vice versa
        if (scope === 'public') {
            if (!isPublicCourseFolder(sanitizedFolder))
                return null;
        }
        else if (scope === 'protected') {
            if (!isProtectedCourseFolder(sanitizedFolder))
                return null;
        }
        else {
            return null;
        }
        // A. S3 Storage Driver: Exact key courses/{scope}/{folder}/{filename} ONLY
        if (index_js_1.config.storage.driver === 's3') {
            const key = `courses/${scope}/${sanitizedFolder}/${sanitizedFilename}`;
            const res = await exports.s3StorageManager.getObjectStream(key, rangeHeader);
            if (!res)
                return null;
            return {
                ...res,
                acceptRanges: 'bytes',
            };
        }
        // B. Local or Persistent Volume Storage Driver: Exact scoped path ONLY
        const baseDir = getActiveStorageDir();
        const expectedDir = path_1.default.resolve(baseDir, 'courses', scope, sanitizedFolder);
        const resolvedPath = path_1.default.resolve(expectedDir, sanitizedFilename);
        // Containment guard: ensure strictly inside expectedDir
        if (!resolvedPath.startsWith(expectedDir + path_1.default.sep) &&
            resolvedPath !== path_1.default.join(expectedDir, sanitizedFilename)) {
            return null;
        }
        if (!fs_1.default.existsSync(resolvedPath)) {
            return null;
        }
        const stat = fs_1.default.statSync(resolvedPath);
        const totalSize = stat.size;
        const contentType = getMimeType(path_1.default.extname(sanitizedFilename));
        if (rangeHeader) {
            const range = parseHttpRange(rangeHeader, totalSize);
            if (!range) {
                throw { statusCode: 416, totalSize };
            }
            const chunkSize = range.end - range.start + 1;
            const stream = fs_1.default.createReadStream(resolvedPath, { start: range.start, end: range.end });
            return {
                stream,
                statusCode: 206,
                contentType,
                contentLength: chunkSize,
                contentRange: `bytes ${range.start}-${range.end}/${totalSize}`,
                acceptRanges: 'bytes',
            };
        }
        // Full file (200)
        const stream = fs_1.default.createReadStream(resolvedPath);
        return {
            stream,
            statusCode: 200,
            contentType,
            contentLength: totalSize,
            acceptRanges: 'bytes',
        };
    },
    async findPublicMediaStream(options) {
        const { filename, rangeHeader } = options;
        if (!filename)
            return null;
        for (const folder of exports.PUBLIC_COURSE_FOLDERS) {
            try {
                const result = await this.getMediaStream({
                    scope: 'public',
                    folder,
                    filename,
                    rangeHeader,
                });
                if (result)
                    return result;
            }
            catch {
                // continue searching remaining public folders
            }
        }
        // Secondary fallback: check apps/web/public/uploads/courses if available (e.g. dev mode static assets)
        try {
            const publicAssetsFile = path_1.default.resolve(process.cwd(), 'apps/web/public/uploads/courses', filename);
            if (fs_1.default.existsSync(publicAssetsFile)) {
                const stat = fs_1.default.statSync(publicAssetsFile);
                const contentType = getMimeType(path_1.default.extname(filename));
                return {
                    stream: fs_1.default.createReadStream(publicAssetsFile),
                    statusCode: 200,
                    contentType,
                    contentLength: stat.size,
                    acceptRanges: 'bytes',
                };
            }
        }
        catch {
            // ignore fallback error
        }
        return null;
    },
    async mediaExists(options) {
        const { scope, folder, filename } = options;
        if (!folder || !filename)
            return false;
        if (filename.includes('..') ||
            filename.includes('/') ||
            filename.includes('\\') ||
            filename.includes('%2e') ||
            filename.includes('%2E')) {
            return false;
        }
        const sanitizedFolder = folder.trim().toLowerCase();
        const sanitizedFilename = sanitizeFilename(filename);
        if (scope === 'public') {
            if (!isPublicCourseFolder(sanitizedFolder))
                return false;
        }
        else if (scope === 'protected') {
            if (!isProtectedCourseFolder(sanitizedFolder))
                return false;
        }
        else {
            return false;
        }
        if (index_js_1.config.storage.driver === 's3') {
            const key = `courses/${scope}/${sanitizedFolder}/${sanitizedFilename}`;
            return exports.s3StorageManager.objectExists(key);
        }
        const baseDir = getActiveStorageDir();
        const expectedDir = path_1.default.resolve(baseDir, 'courses', scope, sanitizedFolder);
        const resolvedPath = path_1.default.resolve(expectedDir, sanitizedFilename);
        if (!resolvedPath.startsWith(expectedDir + path_1.default.sep) &&
            resolvedPath !== path_1.default.join(expectedDir, sanitizedFilename)) {
            return false;
        }
        return fs_1.default.existsSync(resolvedPath);
    },
    async deleteMedia(options) {
        const { scope, folder, filename } = options;
        if (!folder || !filename)
            return false;
        if (filename.includes('..') ||
            filename.includes('/') ||
            filename.includes('\\') ||
            filename.includes('%2e') ||
            filename.includes('%2E')) {
            return false;
        }
        const sanitizedFolder = folder.trim().toLowerCase();
        const sanitizedFilename = sanitizeFilename(filename);
        if (scope === 'public') {
            if (!isPublicCourseFolder(sanitizedFolder))
                return false;
        }
        else if (scope === 'protected') {
            if (!isProtectedCourseFolder(sanitizedFolder))
                return false;
        }
        else {
            return false;
        }
        if (index_js_1.config.storage.driver === 's3') {
            const key = `courses/${scope}/${sanitizedFolder}/${sanitizedFilename}`;
            return exports.s3StorageManager.deleteObject(key);
        }
        const baseDir = getActiveStorageDir();
        const expectedDir = path_1.default.resolve(baseDir, 'courses', scope, sanitizedFolder);
        const resolvedPath = path_1.default.resolve(expectedDir, sanitizedFilename);
        if (!resolvedPath.startsWith(expectedDir + path_1.default.sep) &&
            resolvedPath !== path_1.default.join(expectedDir, sanitizedFilename)) {
            return false;
        }
        if (fs_1.default.existsSync(resolvedPath)) {
            try {
                fs_1.default.unlinkSync(resolvedPath);
                return true;
            }
            catch {
                return false;
            }
        }
        return false;
    },
};
// -------------------------------------------------------------
// PATH SANITIZATION & ABSOLUTE RESOLUTION
// -------------------------------------------------------------
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.');
}
function resolveAbsolutePath(storageKey) {
    if (!storageKey)
        return null;
    if (index_js_1.config.storage.driver === 's3') {
        return null;
    }
    // Reject directory traversal attempts
    if (storageKey.includes('..') ||
        storageKey.includes('%2e%2e') ||
        storageKey.includes('%2E%2E')) {
        return null;
    }
    const cleanKey = storageKey
        .split('?')[0]
        .replace(/^(\/api\/courses\/media\/(public|protected)\/)/, 'courses/$2/')
        .replace(/^(\/api\/students\/photo-raw\/)/, '')
        .replace(/^\/?(uploads\/)/, '')
        .replace(/^[/\\]+/, '');
    const normalizedKey = path_1.default.normalize(cleanKey);
    const activeDir = getActiveStorageDir();
    const resolvedBase = path_1.default.resolve(activeDir);
    const resolvedPath = path_1.default.resolve(resolvedBase, normalizedKey);
    // Strict containment check: must never escape active storage directory
    if (resolvedPath.startsWith(resolvedBase + path_1.default.sep) ||
        resolvedPath === resolvedBase) {
        if (fs_1.default.existsSync(resolvedPath)) {
            return resolvedPath;
        }
    }
    // Cross-check alternative storage locations (e.g. server/uploads vs uploads)
    const altDirs = [
        path_1.default.resolve(process.cwd(), 'server', 'uploads'),
        path_1.default.resolve(process.cwd(), 'uploads'),
        path_1.default.resolve(process.cwd(), '..', 'server', 'uploads'),
        path_1.default.resolve(process.cwd(), '..', 'uploads'),
    ];
    for (const altDir of altDirs) {
        if (fs_1.default.existsSync(altDir)) {
            const candidate = path_1.default.resolve(altDir, normalizedKey);
            if ((candidate.startsWith(altDir + path_1.default.sep) || candidate === altDir) &&
                fs_1.default.existsSync(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}
function getRelativeStorageKey(instituteId, filename) {
    return `${instituteId}/${filename}`;
}
// -------------------------------------------------------------
// MIME TYPE RESOLUTION
// -------------------------------------------------------------
function getMimeType(ext) {
    const normalized = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    const mimeMap = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.ogv': 'video/ogg',
        '.mov': 'video/quicktime',
        '.m4v': 'video/mp4',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.zip': 'application/zip',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.csv': 'text/csv',
        '.txt': 'text/plain',
        '.json': 'application/json',
    };
    return mimeMap[normalized] || 'application/octet-stream';
}
// -------------------------------------------------------------
// MULTER HYBRID STORAGE ENGINES
// -------------------------------------------------------------
exports.ALLOWED_MIME_TYPES = [
    'application/pdf',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    'audio/webm',
    'audio/x-m4a',
    'image/jpeg',
    'image/png',
    'image/webp',
];
exports.MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
exports.ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
exports.MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
exports.ALLOWED_COURSE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/gif',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
];
exports.MAX_COURSE_FILE_SIZE_BYTES = 250 * 1024 * 1024;
/**
 * General Multer Disk Storage (Student photos, learning materials, general documents)
 */
const diskStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        try {
            const instituteId = req.instituteId || 'general';
            const baseDir = getActiveStorageDir();
            const instituteDir = path_1.default.join(baseDir, instituteId);
            if (!fs_1.default.existsSync(instituteDir)) {
                fs_1.default.mkdirSync(instituteDir, { recursive: true });
            }
            cb(null, instituteDir);
        }
        catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const safeName = sanitizeFilename(file.originalname);
        const uniquePrefix = `${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}`;
        cb(null, `${uniquePrefix}-${safeName}`);
    },
});
exports.fileUpload = (0, multer_1.default)({
    storage: diskStorage,
    limits: { fileSize: exports.MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (exports.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, Audio, and Images.`));
        }
    },
});
exports.photoUpload = (0, multer_1.default)({
    storage: diskStorage,
    limits: { fileSize: exports.MAX_PHOTO_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (exports.ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid photograph type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP.`));
        }
    },
});
/**
 * Custom Multer Engine for Course Media:
 * - Writes to persistent volume or local directory when driver is 'volume' or 'local'.
 * - Memory-safe streaming upload directly to AWS S3 via @aws-sdk/lib-storage when driver is 's3'.
 */
class HybridCourseStorageEngine {
    _handleFile(req, file, cb) {
        const rawFolder = req.query?.folder || req.body?.folder || 'general';
        const sanitizedFolder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'general';
        const isPublic = isPublicCourseFolder(sanitizedFolder);
        const scope = isPublic ? 'public' : 'protected';
        const safeName = sanitizeFilename(file.originalname);
        const uniquePrefix = `${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}`;
        const filename = `${uniquePrefix}-${safeName}`;
        if (index_js_1.config.storage.driver === 's3') {
            const s3Client = exports.s3StorageManager.getClient();
            const key = `courses/${scope}/${sanitizedFolder}/${filename}`;
            let bytesUploaded = 0;
            file.stream.on('data', (chunk) => {
                bytesUploaded += chunk.length;
            });
            const upload = new lib_storage_1.Upload({
                client: s3Client,
                params: {
                    Bucket: index_js_1.config.storage.s3.bucket,
                    Key: key,
                    Body: file.stream,
                    ContentType: file.mimetype,
                    Metadata: {
                        originalname: safeName,
                        scope,
                        folder: sanitizedFolder,
                    },
                },
                queueSize: 4,
                partSize: 5 * 1024 * 1024, // 5MB chunks (streamed, not buffered in entire heap)
                leavePartsOnError: false, // Automatically abort multipart upload on failure
            });
            upload.done()
                .then(() => {
                cb(null, {
                    destination: `s3://${index_js_1.config.storage.s3.bucket}/courses/${scope}/${sanitizedFolder}`,
                    filename,
                    path: key,
                    size: bytesUploaded,
                });
            })
                .catch((s3Err) => {
                cb(s3Err);
            });
        }
        else {
            // Local or Persistent Volume
            try {
                const baseDir = getActiveStorageDir();
                const courseDir = path_1.default.join(baseDir, 'courses', scope, sanitizedFolder);
                if (!fs_1.default.existsSync(courseDir)) {
                    fs_1.default.mkdirSync(courseDir, { recursive: true });
                }
                const fullPath = path_1.default.join(courseDir, filename);
                const outStream = fs_1.default.createWriteStream(fullPath);
                let size = 0;
                file.stream.on('data', (chunk) => {
                    size += chunk.length;
                });
                file.stream.pipe(outStream);
                outStream.on('error', (err) => cb(err));
                outStream.on('finish', () => {
                    cb(null, {
                        destination: courseDir,
                        filename,
                        path: fullPath,
                        size,
                    });
                });
            }
            catch (err) {
                cb(err);
            }
        }
    }
    _removeFile(_req, file, cb) {
        if (index_js_1.config.storage.driver === 's3') {
            if (file.path) {
                exports.s3StorageManager.deleteObject(file.path).then(() => cb(null)).catch(cb);
            }
            else {
                cb(null);
            }
        }
        else if (file.path && fs_1.default.existsSync(file.path)) {
            fs_1.default.unlink(file.path, cb);
        }
        else {
            cb(null);
        }
    }
}
exports.courseMediaUpload = (0, multer_1.default)({
    storage: new HybridCourseStorageEngine(),
    limits: { fileSize: exports.MAX_COURSE_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (exports.ALLOWED_COURSE_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: Images, PDFs, Documents, ZIP archives, and Videos.`));
        }
    },
});
