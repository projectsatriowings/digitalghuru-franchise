import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Request } from 'express';
import { config } from '../config/index.js';

// Base directory for local file storage
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), config.storage.localPath || './uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
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
 * Resolve absolute file path from storage key
 */
export function resolveAbsolutePath(storageKey: string): string | null {
  if (!storageKey) return null;
  // Prevent directory traversal
  const normalizedKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');

  const candidateDirs = [
    LOCAL_STORAGE_DIR,
    path.resolve(process.cwd(), 'uploads'),
    path.resolve(process.cwd(), 'server', 'uploads'),
    path.resolve(process.cwd(), '..', 'uploads'),
    path.resolve(process.cwd(), '..', 'server', 'uploads'),
  ];

  for (const baseDir of candidateDirs) {
    const fullPath = path.join(baseDir, normalizedKey);
    if (fullPath.startsWith(baseDir) && fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}
