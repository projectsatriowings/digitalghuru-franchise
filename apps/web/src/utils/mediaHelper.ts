import { apiFetch } from '../services/api';

/**
 * Enterprise Media & Resource URL Utilities
 * Handles validation, normalization, metadata resolution, and secure opening
 * for all educational resource formats: PPT, PPTX, DOC, DOCX, PDF, XLS, XLSX, ZIP, Images, and Cloud Links.
 */

export interface MediaResourceMeta {
  label: string;
  badge: string;
  category: 'presentation' | 'document' | 'spreadsheet' | 'pdf' | 'archive' | 'image' | 'cloud' | 'link';
}

/**
 * Detects the file format and returns user-friendly label, badge, and category
 * for PPT, DOC, PDF, spreadsheets, and cloud documents.
 */
export function getMediaResourceMeta(rawUrl?: string | null): MediaResourceMeta {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { label: 'Lesson Document', badge: 'DOC', category: 'document' };
  }

  const clean = rawUrl.trim().split('?')[0].toLowerCase();

  // 1. PowerPoint / Presentations
  if (
    clean.endsWith('.ppt') ||
    clean.endsWith('.pptx') ||
    clean.endsWith('.odp') ||
    clean.includes('slides.google.com') ||
    clean.includes('/presentation')
  ) {
    return { label: 'Presentation (PPT)', badge: 'PPT', category: 'presentation' };
  }

  // 2. Word / Text Documents
  if (
    clean.endsWith('.doc') ||
    clean.endsWith('.docx') ||
    clean.endsWith('.odt') ||
    clean.endsWith('.rtf') ||
    clean.includes('docs.google.com/document')
  ) {
    return { label: 'Word Document (DOC)', badge: 'DOC', category: 'document' };
  }

  // 3. PDF Documents
  if (clean.endsWith('.pdf')) {
    return { label: 'PDF Document', badge: 'PDF', category: 'pdf' };
  }

  // 4. Spreadsheets / Tables
  if (
    clean.endsWith('.xls') ||
    clean.endsWith('.xlsx') ||
    clean.endsWith('.csv') ||
    clean.endsWith('.ods') ||
    clean.includes('docs.google.com/spreadsheets') ||
    clean.includes('sheets.google.com')
  ) {
    return { label: 'Spreadsheet (Excel)', badge: 'XLS', category: 'spreadsheet' };
  }

  // 5. Compressed Archives
  if (clean.endsWith('.zip') || clean.endsWith('.rar') || clean.endsWith('.7z') || clean.endsWith('.tar.gz')) {
    return { label: 'ZIP Archive', badge: 'ZIP', category: 'archive' };
  }

  // 6. Visual Media
  if (/\.(png|jpe?g|webp|svg|gif)$/i.test(clean)) {
    return { label: 'Image Asset', badge: 'IMG', category: 'image' };
  }

  // 7. Cloud Workspaces (Drive, Canva, Notion, Figma, etc.)
  if (
    clean.includes('drive.google.com') ||
    clean.includes('dropbox.com') ||
    clean.includes('onedrive.live.com') ||
    clean.includes('canva.com') ||
    clean.includes('figma.com') ||
    clean.includes('notion.so')
  ) {
    return { label: 'Cloud Workspace', badge: 'CLOUD', category: 'cloud' };
  }

  return { label: 'Study Document', badge: 'DOC', category: 'document' };
}

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
  type?: 'document' | 'pdf' | 'presentation' | 'video' | 'attachment';
  onError?: (errorMessage: string) => void;
}

/**
 * Safely resolves and opens course resources in a new browser tab.
 * - Supports PPT, PPTX, DOC, DOCX, PDF, XLS, ZIP, Images, and Cloud Links.
 * - Prevents non-URL strings (like "xfdgdsgfs") from triggering SPA catch-all redirection to dashboard
 * - Obtains short-lived media authorization tokens for protected course assets
 */
export async function openMediaResource({
  url,
  courseId,
  type = 'document',
  onError,
}: OpenMediaResourceOptions): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    onError?.(`No document or resource file has been configured for this lesson.`);
    return false;
  }

  const clean = url.trim();

  if (!isValidMediaResourceUrl(clean)) {
    onError?.(
      `"${clean}" is not a valid document or link. Please upload your file (PPT, DOC, PDF, etc.) or enter a working web URL (e.g. https://...).`
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
      const authorizedUrl = res?.data?.mediaUrl || res?.mediaUrl;
      if (authorizedUrl) {
        targetUrl = authorizedUrl;
      } else {
        onError?.(res?.message || 'Could not generate media authorization token. Please verify your login.');
        return false;
      }
    } catch (err: any) {
      console.warn('[mediaHelper] Failed to acquire short-lived media token:', err);
      onError?.(err?.message || 'Unable to access protected course document.');
      return false;
    }
  }

  window.open(targetUrl, '_blank', 'noopener,noreferrer');
  return true;
}
