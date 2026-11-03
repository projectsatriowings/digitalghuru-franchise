import { apiFetch } from './api';

export interface TargetVerificationResult {
  available: boolean;
  entityType?: string;
  entityId?: string;
  details?: any;
}

/**
 * Mark all unread notifications matching a specific entity as read (Normal Navigation Sync)
 */
export async function markNotificationEntityAsRead(
  entityType: string,
  entityId: string,
  studentId?: string
): Promise<{ markedReadCount: number; unreadCount: number } | null> {
  if (!entityType || !entityId) return null;
  try {
    const res = await apiFetch('/notifications/mark-read-by-entity', {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId, studentId }),
    });
    if (res.success && res.data) {
      return res.data;
    }
  } catch (err) {
    console.warn('[markNotificationEntityAsRead Error]', err);
  }
  return null;
}

/**
 * Verify whether target content exists, is published, and is accessible before navigating
 */
export async function verifyNotificationTarget(
  entityType?: string | null,
  entityId?: string | null
): Promise<TargetVerificationResult> {
  if (!entityType || !entityId) {
    return { available: true };
  }
  try {
    const res = await apiFetch(`/notifications/verify-target?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`);
    if (res.success && res.data) {
      return res.data;
    }
  } catch (err) {
    console.warn('[verifyNotificationTarget Error]', err);
  }
  return { available: true };
}

