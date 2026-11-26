import { apiFetch } from '../services/api';

/**
 * Enterprise Media & Resource URL Utilities
 * Handles validation, normalization, and secure opening of course assets
 * (PDFs, videos, attachments) preventing SPA route hijacking and broken relative redirects.
 */

export function isValidMediaResourceUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const clean = raw.trim();
  if (!clean) return false;

  // 1. Standard web protocols
  if (/^https?:\/\//i.test(clean)) return true;

  // 2. Relative API or backend storage paths
  if (clean.startsWith('/api/') || clean.startsWith('/uploads/')) return true;

  // 3. Blob or Data URLs
  if (clean.startsWith('blob:') || clean.startsWith('data:')) return true;

  // 4. Naked domains (e.g. drive.google.com/..., www.youtube.com, etc.)
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(clean) && !clean.includes(' ')) {
    return true;
  }

  return false;
}

export function normalizeMediaUrl(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (!clean) return '';

  if (/^https?:\/\//i.test(clean) || clean.startsWith('/') || clean.startsWith('blob:') || clean.startsWith('data:')) {
    return clean;
  }

  // Prepend https:// for naked domains
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(clean) && !clean.includes(' ')) {
    return `https://${clean}`;
  }

  return clean;
}

export interface OpenMediaResourceOptions {
  url?: string | null;
  courseId?: string;
  type?: 'pdf' | 'video' | 'attachment';
  onError?: (errorMessage: string) => void;
}

/**
 * Safely resolves and opens course resources in a new browser tab.
 * - Prevents non-URL strings (like "xfdgdsgfs") from triggering SPA catch-all redirection to dashboard
 * - Obtains short-lived media authorization tokens for protected course assets
 */
export async function openMediaResource({
  url,
  courseId,
  type = 'pdf',
  onError,
}: OpenMediaResourceOptions): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    onError?.(`No ${type.toUpperCase()} link or document has been configured.`);
    return false;
  }

  const clean = url.trim();

  if (!isValidMediaResourceUrl(clean)) {
    onError?.(
      `"${clean}" is not a valid ${type.toUpperCase()} link or file path. Please enter a valid web URL (e.g. https://...) or upload a file.`
    );
    return false;
  }

  let targetUrl = normalizeMediaUrl(clean);

  // If this is a protected backend media asset, acquire a short-lived media token
  if (targetUrl.includes('/media/protected/')) {
    try {
      const res = await apiFetch('/courses/media-token', {
        method: 'POST',
        body: JSON.stringify({ courseId, mediaUrl: targetUrl }),
      });
      if (res?.data?.mediaUrl) {
        targetUrl = res.data.mediaUrl;
      }
    } catch (err: any) {
      console.warn('[mediaHelper] Failed to acquire short-lived media token:', err);
      // Fallback to attempting original URL
    }
  }

  window.open(targetUrl, '_blank', 'noopener,noreferrer');
  return true;
}
