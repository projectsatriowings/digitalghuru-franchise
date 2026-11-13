import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Request } from 'express';
import { config } from '../config/index.js';

// Base directory for local / persistent volume file storage
export function getActiveStorageDir(): string {
  if (config.storage.driver === 'volume' && config.storage.persistentVolumePath) {
    return path.resolve(config.storage.persistentVolumePath);
  }
  return path.resolve(process.cwd(), config.storage.localPath || './uploads');
}

const LOCAL_STORAGE_DIR = getActiveStorageDir();

// Ensure local uploads directory exists
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

// Ensure partitioned public and protected course directories exist
export const PUBLIC_COURSE_FOLDERS = ['thumbnails', 'banners', 'brochures', 'public', 'promotional', 'marketing'];
export const PROTECTED_COURSE_FOLDERS = ['attachments', 'videos', 'lessons', 'materials', 'worksheets', 'protected', 'resources'];

export function isPublicCourseFolder(folder: string): boolean {
  if (!folder) return false;
  return PUBLIC_COURSE_FOLDERS.includes(folder.trim().toLowerCase());
}

for (const folder of PUBLIC_COURSE_FOLDERS) {
  const dir = path.join(LOCAL_STORAGE_DIR, 'courses', 'public', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

for (const folder of PROTECTED_COURSE_FOLDERS) {
  const dir = path.join(LOCAL_STORAGE_DIR, 'courses', 'protected', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Allowlist of allowed MIME types
export const ALLOWED_MIME_TYPES = [
  // PDFs
  'application/pdf',
  // Audio & Voice notes
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/m4a',
  'audio/webm',
  'audio/x-m4a',
  // Educational Images
  'image/jpeg',
  'image/png',
  'image/webp',
];

// Max file size: 25MB
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Photo specific constraints (5MB max, image types only)
export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB max

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.');
}

/**
 * Configure Multer disk storage for local environment
 */
const storage = multer.diskStorage({
  destination: (req: Request, file: any, cb: any) => {
    const instituteId = (req as any).instituteId || 'general';
    const instituteDir = path.join(LOCAL_STORAGE_DIR, instituteId);
    if (!fs.existsSync(instituteDir)) {
      fs.mkdirSync(instituteDir, { recursive: true });
    }
    cb(null, instituteDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const safeName = sanitizeFilename(file.originalname);
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

/**
 * Multer upload middleware with mime type validation and size limits
 */
export const fileUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req: any, file: any, cb: any) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, Audio, and Images.`));
    }
  },
});

/**
 * Dedicated student photo upload middleware (5MB limit, strictly image formats)
 */
export const photoUpload = multer({
  storage,
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
 * Generate relative storage path for a file
 */
export function getRelativeStorageKey(instituteId: string, filename: string): string {
  return `${instituteId}/${filename}`;
}

/**
 * Resolve absolute file path from storage key with strict directory traversal protection
 */
export function resolveAbsolutePath(storageKey: string): string | null {
  if (!storageKey) return null;
  // Strip query strings or leading slashes/api prefixes
  const cleanKey = storageKey
    .split('?')[0]
    .replace(/^(\/api\/courses\/media\/(public|protected)\/)/, 'courses/$2/')
    .replace(/^\/?(uploads\/)/, '')
    .replace(/^[/\\]+/, '');

  // Normalize and prevent directory traversal
  const normalizedKey = path.normalize(cleanKey).replace(/^(\.\.[\/\\])+/, '');

  const activeDir = getActiveStorageDir();
  const candidateDirs = [
    activeDir,
    path.resolve(process.cwd(), 'uploads'),
    path.resolve(process.cwd(), 'server', 'uploads'),
    path.resolve(process.cwd(), '..', 'uploads'),
    path.resolve(process.cwd(), '..', 'server', 'uploads'),
  ];

  const candidateSubpaths: string[] = [normalizedKey];
  if (normalizedKey.startsWith('courses' + path.sep) || normalizedKey.startsWith('courses/')) {
    const rel = normalizedKey.replace(/^courses[/\\]/, '');
    candidateSubpaths.push(
      path.join('courses', 'protected', rel),
      path.join('courses', 'public', rel),
      normalizedKey
    );
  }

  for (const baseDir of candidateDirs) {
    const resolvedBase = path.resolve(baseDir);
    for (const sub of candidateSubpaths) {
      const fullPath = path.resolve(resolvedBase, sub);
      if ((fullPath === resolvedBase || fullPath.startsWith(resolvedBase + path.sep)) && fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Common MIME type mapping for course media and streaming
 */
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

/**
 * Course media storage (thumbnails, banners, brochures, videos, worksheets)
 * Strictly separates public promotional media from private protected curriculum media.
 */
const courseStorage = multer.diskStorage({
  destination: (req: Request, file: any, cb: any) => {
    const rawFolder = (req.query?.folder as string) || (req.body?.folder as string) || 'general';
    const sanitizedFolder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
    const isPublic = isPublicCourseFolder(sanitizedFolder);
    const scopeFolder = isPublic ? 'public' : 'protected';
    const courseDir = path.join(LOCAL_STORAGE_DIR, 'courses', scopeFolder, sanitizedFolder);
    if (!fs.existsSync(courseDir)) {
      fs.mkdirSync(courseDir, { recursive: true });
    }
    cb(null, courseDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const safeName = sanitizeFilename(file.originalname);
    const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

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

export const MAX_COURSE_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250MB for video & archive media

export const courseMediaUpload = multer({
  storage: courseStorage,
  limits: { fileSize: MAX_COURSE_FILE_SIZE_BYTES },
  fileFilter: (req: any, file: any, cb: any) => {
    if (ALLOWED_COURSE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: Images, PDFs, Documents, ZIP archives, and Videos.`));
    }
  },
});

