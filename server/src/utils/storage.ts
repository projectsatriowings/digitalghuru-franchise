import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Readable } from 'stream';
import { Request } from 'express';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { config, validateStorageConfig } from '../config/index.js';

// -------------------------------------------------------------
// FOLDER PARTITIONS & SCOPES (STRICT ISOLATION)
// -------------------------------------------------------------
export const PUBLIC_COURSE_FOLDERS = [
  'thumbnails',
  'banners',
  'brochures',
  'public',
  'promotional',
  'marketing',
];

export const PROTECTED_COURSE_FOLDERS = [
  'attachments',
  'videos',
  'lessons',
  'materials',
  'worksheets',
  'protected',
  'resources',
  'general',
];

export function isPublicCourseFolder(folder: string): boolean {
  if (!folder) return false;
  return PUBLIC_COURSE_FOLDERS.includes(folder.trim().toLowerCase());
}

export function isProtectedCourseFolder(folder: string): boolean {
  if (!folder) return false;
  return PROTECTED_COURSE_FOLDERS.includes(folder.trim().toLowerCase());
}

// -------------------------------------------------------------
// ACTIVE STORAGE DIRECTORY RESOLUTION
// -------------------------------------------------------------
/**
 * Resolves the active base directory for local or persistent volume storage.
 * In volume mode, strictly requires PERSISTENT_VOLUME_PATH and rejects silent local fallbacks.
 * In S3 mode, throws because S3 does not use a local directory.
 */
export function getActiveStorageDir(): string {
  if (config.storage.driver === 'volume') {
    if (!config.storage.persistentVolumePath || !config.storage.persistentVolumePath.trim()) {
      throw new Error(
        '[Storage Configuration Error]: STORAGE_DRIVER is set to "volume" but PERSISTENT_VOLUME_PATH is not configured. ' +
        'Refusing to silently fall back to local ephemeral storage.'
      );
    }
    return path.resolve(config.storage.persistentVolumePath.trim());
  }

  if (config.storage.driver === 's3') {
    throw new Error(
      '[Storage Configuration Error]: getActiveStorageDir() invoked while STORAGE_DRIVER="s3". S3 storage uses object keys, not local filesystem paths.'
    );
  }

  return path.resolve(process.cwd(), config.storage.localPath || './uploads');
}

/**
 * Initializes required folder partitions on disk for local and volume drivers.
 */
export function initDiskStorageDirectories(): void {
  if (config.storage.driver === 's3') return;

  const baseDir = getActiveStorageDir();
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  for (const folder of PUBLIC_COURSE_FOLDERS) {
    const dir = path.join(baseDir, 'courses', 'public', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  for (const folder of PROTECTED_COURSE_FOLDERS) {
    const dir = path.join(baseDir, 'courses', 'protected', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

// Initialize directories if local/volume configured safely
try {
  if (config.storage.driver !== 's3') {
    initDiskStorageDirectories();
  }
} catch {
  // Postpone startup failures to explicit validateStorageConfig() invocation
}

// -------------------------------------------------------------
// STARTUP DIAGNOSTICS
// -------------------------------------------------------------
export function printStorageDiagnostics(): void {
  try {
    const validation = validateStorageConfig();
    console.log('------------------------------------------------------------');
    console.log('[Storage Diagnostics]');
    console.log(`  Driver:              ${validation.driver.toUpperCase()}`);
    console.log(`  Resolved Location:   ${validation.resolvedLocation}`);
    console.log(`  Health Status:       ${validation.statusMessage}`);
    if (config.storage.driver === 'volume') {
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
  } catch (err: any) {
    console.error('------------------------------------------------------------');
    console.error('[Storage Diagnostics CRITICAL FAILURE]');
    console.error(`  ${err.message}`);
    console.error('------------------------------------------------------------');
    throw err;
  }
}

// -------------------------------------------------------------
// RFC 7233 HTTP BYTE-RANGE PARSING
// -------------------------------------------------------------
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses HTTP Range headers in compliance with RFC 7233:
 * - Closed range: bytes=0-1023
 * - Prefix range: bytes=1024- (from 1024 to EOF)
 * - Suffix range: bytes=-500 (last 500 bytes of file)
 * Throws { statusCode: 416, totalSize } for unsatisfiable or malformed ranges.
 */
export function parseHttpRange(rangeHeader: string, totalSize: number): ByteRange | null {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;
  const rangeSpec = rangeHeader.replace(/^bytes=/, '').trim();
  if (!rangeSpec || rangeSpec.includes(',')) {
    throw { statusCode: 416, totalSize };
  }

  const parts = rangeSpec.split('-');
  if (parts.length !== 2) throw { statusCode: 416, totalSize };

  let start: number;
  let end: number;

  if (parts[0] === '') {
    // Suffix range: bytes=-500 (last 500 bytes)
    const suffix = parseInt(parts[1], 10);
    if (isNaN(suffix) || suffix <= 0) throw { statusCode: 416, totalSize };
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else if (parts[1] === '') {
    // Prefix range: bytes=1024- (from 1024 to EOF)
    start = parseInt(parts[0], 10);
    if (isNaN(start) || start < 0 || start >= totalSize) throw { statusCode: 416, totalSize };
    end = totalSize - 1;
  } else {
    // Closed range: bytes=0-1023
    start = parseInt(parts[0], 10);
    end = parseInt(parts[1], 10);
    if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
      throw { statusCode: 416, totalSize };
    }
    if (end >= totalSize) {
      end = totalSize - 1;
    }
  }

  return { start, end };
}

// -------------------------------------------------------------
// S3 OBJECT STORAGE MANAGER
// -------------------------------------------------------------
export class S3StorageManager {
  private client: S3Client | null = null;

  getClient(): S3Client {
    if (!this.client) {
      const { bucket, region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = config.storage.s3;
      if (!bucket || !accessKeyId || !secretAccessKey) {
        throw new Error(
          '[S3 Storage Error]: S3 client accessed without complete credentials. ' +
          'Configure S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.'
        );
      }
      this.client = new S3Client({
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
  async uploadStream(options: {
    key: string;
    stream: NodeJS.ReadableStream;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; size: number }> {
    const client = this.getClient();
    let bytesUploaded = 0;
    options.stream.on('data', (chunk) => {
      bytesUploaded += chunk.length;
    });

    const upload = new Upload({
      client,
      params: {
        Bucket: config.storage.s3.bucket,
        Key: options.key,
        Body: options.stream as any,
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

  async uploadFile(options: {
    key: string;
    buffer: Buffer;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; size: number }> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: config.storage.s3.bucket,
        Key: options.key,
        Body: options.buffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
      })
    );
    return { key: options.key, size: options.buffer.length };
  }

  async getObjectStream(
    key: string,
    range?: string
  ): Promise<{
    stream: NodeJS.ReadableStream;
    statusCode: 200 | 206;
    contentType: string;
    contentLength: number;
    contentRange?: string;
  } | null> {
    const client = this.getClient();
    try {
      let rangeHeaderToSend = range;
      if (range) {
        try {
          const head = await client.send(
            new HeadObjectCommand({
              Bucket: config.storage.s3.bucket,
              Key: key,
            })
          );
          const totalSize = head.ContentLength || 0;
          const parsedRange = parseHttpRange(range, totalSize);
          if (parsedRange) {
            rangeHeaderToSend = `bytes=${parsedRange.start}-${parsedRange.end}`;
          }
        } catch (headErr: any) {
          if (headErr.statusCode === 416) throw headErr;
        }
      }

      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.storage.s3.bucket,
          Key: key,
          ...(rangeHeaderToSend ? { Range: rangeHeaderToSend } : {}),
        })
      );

      const stream = response.Body as any;
      const statusCode = rangeHeaderToSend && response.ContentRange ? 206 : 200;
      const contentLength = response.ContentLength || 0;
      const contentType = response.ContentType || getMimeType(path.extname(key));
      const contentRange = response.ContentRange;

      return {
        stream,
        statusCode,
        contentType,
        contentLength,
        contentRange,
      };
    } catch (err: any) {
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

  async objectExists(key: string): Promise<boolean> {
    const client = this.getClient();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: config.storage.s3.bucket,
          Key: key,
        })
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      return false;
    }
  }

  async deleteObject(key: string): Promise<boolean> {
    const client = this.getClient();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.storage.s3.bucket,
          Key: key,
        })
      );
      return true;
    } catch (err: any) {
      console.error(`[S3 Storage Error] Failed to delete object ${key}:`, err.message);
      return false;
    }
  }
}

export const s3StorageManager = new S3StorageManager();

// -------------------------------------------------------------
// UNIFIED STORAGE MANAGER (STRICT SCOPED ISOLATION)
// -------------------------------------------------------------
export const StorageManager = {
  validate: validateStorageConfig,
  printDiagnostics: printStorageDiagnostics,

  async getMediaStream(options: {
    scope: 'public' | 'protected';
    folder: string;
    filename: string;
    rangeHeader?: string;
  }): Promise<{
    stream: NodeJS.ReadableStream;
    statusCode: 200 | 206;
    contentType: string;
    contentLength: number;
    contentRange?: string;
    acceptRanges: string;
  } | null> {
    const { scope, folder, filename, rangeHeader } = options;

    if (!folder || !filename) return null;
    // Strict rejection of path traversal
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('%2e') ||
      filename.includes('%2E')
    ) {
      return null;
    }

    const sanitizedFolder = folder.trim().toLowerCase();
    const sanitizedFilename = sanitizeFilename(filename);

    // Strict scope validation: public cannot access protected folders and vice versa
    if (scope === 'public') {
      if (!isPublicCourseFolder(sanitizedFolder)) return null;
    } else if (scope === 'protected') {
      if (!isProtectedCourseFolder(sanitizedFolder)) return null;
    } else {
      return null;
    }

    // A. S3 Storage Driver: Exact key courses/{scope}/{folder}/{filename} ONLY
    if (config.storage.driver === 's3') {
      const key = `courses/${scope}/${sanitizedFolder}/${sanitizedFilename}`;
      const res = await s3StorageManager.getObjectStream(key, rangeHeader);
      if (!res) return null;
      return {
        ...res,
        acceptRanges: 'bytes',
      };
    }

    // B. Local or Persistent Volume Storage Driver: Exact scoped path ONLY
    const baseDir = getActiveStorageDir();
    const expectedDir = path.resolve(baseDir, 'courses', scope, sanitizedFolder);
    const resolvedPath = path.resolve(expectedDir, sanitizedFilename);

    // Containment guard: ensure strictly inside expectedDir
    if (
      !resolvedPath.startsWith(expectedDir + path.sep) &&
      resolvedPath !== path.join(expectedDir, sanitizedFilename)
    ) {
      return null;
    }

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const stat = fs.statSync(resolvedPath);
    const totalSize = stat.size;
    const contentType = getMimeType(path.extname(sanitizedFilename));

    if (rangeHeader) {
      const range = parseHttpRange(rangeHeader, totalSize);
      if (!range) {
        throw { statusCode: 416, totalSize };
      }

      const chunkSize = range.end - range.start + 1;
      const stream = fs.createReadStream(resolvedPath, { start: range.start, end: range.end });
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
    const stream = fs.createReadStream(resolvedPath);
    return {
      stream,
      statusCode: 200,
      contentType,
      contentLength: totalSize,
      acceptRanges: 'bytes',
    };
  },

  async mediaExists(options: {
    scope: 'public' | 'protected';
    folder: string;
    filename: string;
  }): Promise<boolean> {
    const { scope, folder, filename } = options;
    if (!folder || !filename) return false;
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('%2e') ||
      filename.includes('%2E')
    ) {
      return false;
    }

    const sanitizedFolder = folder.trim().toLowerCase();
    const sanitizedFilename = sanitizeFilename(filename);

    if (scope === 'public') {
      if (!isPublicCourseFolder(sanitizedFolder)) return false;
    } else if (scope === 'protected') {
      if (!isProtectedCourseFolder(sanitizedFolder)) return false;
    } else {
      return false;
    }

    if (config.storage.driver === 's3') {
      const key = `courses/${scope}/${sanitizedFolder}/${sanitizedFilename}`;
      return s3StorageManager.objectExists(key);
    }

    const baseDir = getActiveStorageDir();
    const expectedDir = path.resolve(baseDir, 'courses', scope, sanitizedFolder);
    const resolvedPath = path.resolve(expectedDir, sanitizedFilename);
    if (
      !resolvedPath.startsWith(expectedDir + path.sep) &&
      resolvedPath !== path.join(expectedDir, sanitizedFilename)
    ) {
      return false;
    }
    return fs.existsSync(resolvedPath);
  },

  async deleteMedia(options: {
    scope: 'public' | 'protected';
    folder: string;
    filename: string;
  }): Promise<boolean> {
    const { scope, folder, filename } = options;
    if (!folder || !filename) return false;
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('%2e') ||
      filename.includes('%2E')
    ) {
      return false;
    }

    const sanitizedFolder = folder.trim().toLowerCase();
    const sanitizedFilename = sanitizeFilename(filename);

    if (scope === 'public') {
      if (!isPublicCourseFolder(sanitizedFolder)) return false;
    } else if (scope === 'protected') {
      if (!isProtectedCourseFolder(sanitizedFolder)) return false;
    } else {
      return false;
    }

    if (config.storage.driver === 's3') {
      const key = `courses/${scope}/${sanitizedFolder}/${sanitizedFilename}`;
      return s3StorageManager.deleteObject(key);
    }

    const baseDir = getActiveStorageDir();
    const expectedDir = path.resolve(baseDir, 'courses', scope, sanitizedFolder);
    const resolvedPath = path.resolve(expectedDir, sanitizedFilename);
    if (
      !resolvedPath.startsWith(expectedDir + path.sep) &&
      resolvedPath !== path.join(expectedDir, sanitizedFilename)
    ) {
      return false;
    }

    if (fs.existsSync(resolvedPath)) {
      try {
        fs.unlinkSync(resolvedPath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
};

// -------------------------------------------------------------
// PATH SANITIZATION & ABSOLUTE RESOLUTION
// -------------------------------------------------------------
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.');
}

export function resolveAbsolutePath(storageKey: string): string | null {
  if (!storageKey) return null;
  if (config.storage.driver === 's3') {
    return null;
  }

  // Reject directory traversal attempts
  if (
    storageKey.includes('..') ||
    storageKey.includes('%2e%2e') ||
    storageKey.includes('%2E%2E')
  ) {
    return null;
  }

  const cleanKey = storageKey
    .split('?')[0]
    .replace(/^(\/api\/courses\/media\/(public|protected)\/)/, 'courses/$2/')
    .replace(/^\/?(uploads\/)/, '')
    .replace(/^[/\\]+/, '');

  const normalizedKey = path.normalize(cleanKey);
  const activeDir = getActiveStorageDir();
  const resolvedBase = path.resolve(activeDir);

  const resolvedPath = path.resolve(resolvedBase, normalizedKey);

  // Strict containment check: must never escape active storage directory
  if (
    !resolvedPath.startsWith(resolvedBase + path.sep) &&
    resolvedPath !== resolvedBase
  ) {
    return null;
  }

  if (fs.existsSync(resolvedPath)) {
    return resolvedPath;
  }

  return null;
}

export function getRelativeStorageKey(instituteId: string, filename: string): string {
  return `${instituteId}/${filename}`;
}

// -------------------------------------------------------------
// MIME TYPE RESOLUTION
// -------------------------------------------------------------
export function getMimeType(ext: string): string {
  const normalized = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  const mimeMap: Record<string, string> = {
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
export const ALLOWED_MIME_TYPES = [
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

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_COURSE_MIME_TYPES = [
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

export const MAX_COURSE_FILE_SIZE_BYTES = 250 * 1024 * 1024;

/**
 * General Multer Disk Storage (Student photos, learning materials, general documents)
 */
const diskStorage = multer.diskStorage({
  destination: (req: Request, file: any, cb: any) => {
    try {
      const instituteId = (req as any).instituteId || 'general';
      const baseDir = getActiveStorageDir();
      const instituteDir = path.join(baseDir, instituteId);
      if (!fs.existsSync(instituteDir)) {
        fs.mkdirSync(instituteDir, { recursive: true });
      }
      cb(null, instituteDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req: any, file: any, cb: any) => {
    const safeName = sanitizeFilename(file.originalname);
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

export const fileUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req: any, file: any, cb: any) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, Audio, and Images.`));
    }
  },
});

export const photoUpload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter: (req: any, file: any, cb: any) => {
    if (ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid photograph type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP.`));
    }
  },
});

/**
 * Custom Multer Engine for Course Media:
 * - Writes to persistent volume or local directory when driver is 'volume' or 'local'.
 * - Memory-safe streaming upload directly to AWS S3 via @aws-sdk/lib-storage when driver is 's3'.
 */
class HybridCourseStorageEngine implements multer.StorageEngine {
  _handleFile(req: Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<Express.Multer.File>) => void) {
    const rawFolder = (req.query?.folder as string) || (req.body?.folder as string) || 'general';
    const sanitizedFolder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'general';
    const isPublic = isPublicCourseFolder(sanitizedFolder);
    const scope = isPublic ? 'public' : 'protected';
    const safeName = sanitizeFilename(file.originalname);
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const filename = `${uniquePrefix}-${safeName}`;

    if (config.storage.driver === 's3') {
      const s3Client = s3StorageManager.getClient();
      const key = `courses/${scope}/${sanitizedFolder}/${filename}`;

      let bytesUploaded = 0;
      file.stream.on('data', (chunk) => {
        bytesUploaded += chunk.length;
      });

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: config.storage.s3.bucket,
          Key: key,
          Body: file.stream as any,
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
            destination: `s3://${config.storage.s3.bucket}/courses/${scope}/${sanitizedFolder}`,
            filename,
            path: key,
            size: bytesUploaded,
          });
        })
        .catch((s3Err) => {
          cb(s3Err);
        });
    } else {
      // Local or Persistent Volume
      try {
        const baseDir = getActiveStorageDir();
        const courseDir = path.join(baseDir, 'courses', scope, sanitizedFolder);
        if (!fs.existsSync(courseDir)) {
          fs.mkdirSync(courseDir, { recursive: true });
        }
        const fullPath = path.join(courseDir, filename);
        const outStream = fs.createWriteStream(fullPath);
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
      } catch (err) {
        cb(err);
      }
    }
  }

  _removeFile(_req: Request, file: Express.Multer.File, cb: (error: Error | null) => void) {
    if (config.storage.driver === 's3') {
      if (file.path) {
        s3StorageManager.deleteObject(file.path).then(() => cb(null)).catch(cb);
      } else {
        cb(null);
      }
    } else if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, cb);
    } else {
      cb(null);
    }
  }
}

export const courseMediaUpload = multer({
  storage: new HybridCourseStorageEngine(),
  limits: { fileSize: MAX_COURSE_FILE_SIZE_BYTES },
  fileFilter: (req: any, file: any, cb: any) => {
    if (ALLOWED_COURSE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: Images, PDFs, Documents, ZIP archives, and Videos.`));
    }
  },
});
