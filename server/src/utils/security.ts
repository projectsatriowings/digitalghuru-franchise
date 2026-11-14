import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config, DEV_MEDIA_TOKEN_SECRET_FALLBACK } from '../config/index.js';

export interface TokenPayload {
  userId: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  instituteId?: string | null;
  franchiseId?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateSecureRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a strong permanent password with at least 16 cryptographically random bytes of entropy.
 * 16 bytes = 128 bits of entropy.
 * Format: DG#<32-hex-characters>!
 */
export function generatePermanentPassword(bytes: number = 16): string {
  const entropyBytes = Math.max(16, bytes);
  const randomHex = crypto.randomBytes(entropyBytes).toString('hex');
  return `DG#${randomHex}!`;
}


// -------------------------------------------------------------
// DEDICATED SHORT-LIVED MEDIA AUTHORIZATION TOKENS (PHASE 1.1.2)
// -------------------------------------------------------------
export interface MediaTokenPayload {
  sub: string; // userId
  role: string;
  courseId: string;
  scope: 'protected';
  folder: string;
  filename: string;
  mediaKey: string;
  type: 'media_token';
  iat?: number;
  exp?: number;
}

/**
 * Returns the independent media token secret.
 * Throws in production if missing, strictly forbidding fallback to JWT_SECRET.
 */
export function getMediaTokenSecret(): string {
  const secret = config.jwt.mediaTokenSecret;
  if (!secret) {
    if (config.nodeEnv === 'production') {
      throw new Error(
        '[Security Error]: MEDIA_TOKEN_SECRET is not configured in production. ' +
        'Media tokens cannot be signed or verified without an independent production secret.'
      );
    }
    return DEV_MEDIA_TOKEN_SECRET_FALLBACK;
  }
  return secret;
}

/**
 * Generates a short-lived, cryptographically bound media authorization token.
 * Uses a dedicated media token secret separate from the application login JWT secret.
 */
export function generateMediaToken(payload: {
  userId: string;
  role: string;
  courseId: string;
  folder: string;
  filename: string;
  expiresInSeconds?: number;
}): string {
  const secret = getMediaTokenSecret();
  const expiresIn = payload.expiresInSeconds || config.jwt.mediaTokenExpiresInSeconds || 900;
  const tokenData: MediaTokenPayload = {
    sub: payload.userId,
    role: payload.role,
    courseId: payload.courseId,
    scope: 'protected',
    folder: payload.folder.trim().toLowerCase(),
    filename: payload.filename.trim(),
    mediaKey: `courses/protected/${payload.folder.trim().toLowerCase()}/${payload.filename.trim()}`,
    type: 'media_token',
  };
  return jwt.sign(tokenData, secret, {
    expiresIn,
  } as jwt.SignOptions);
}

/**
 * Verifies a media token. Rejects expired tokens, tokens signed with different keys,
 * or tokens with type mismatch (e.g. normal login access tokens passed in media URLs).
 */
export function verifyMediaToken(token: string): MediaTokenPayload | null {
  try {
    const secret = getMediaTokenSecret();
    const decoded = jwt.verify(token, secret) as MediaTokenPayload;
    if (
      decoded &&
      decoded.type === 'media_token' &&
      decoded.sub &&
      decoded.filename &&
      decoded.folder &&
      decoded.scope === 'protected'
    ) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}
