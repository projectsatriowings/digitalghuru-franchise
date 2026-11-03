import React, { useState, useEffect, useMemo } from 'react';
import { getAuthToken, getActiveInstituteId } from '../services/api';

export interface StaffAvatarProps {
  staffId?: string;
  avatarUrl?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

const SIZE_MAP: Record<string, { container: string; text: string; sizePx: number }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', sizePx: 24 },
  sm: { container: 'w-8 h-8', text: 'text-xs', sizePx: 32 },
  md: { container: 'w-10 h-10', text: 'text-sm', sizePx: 40 },
  lg: { container: 'w-14 h-14', text: 'text-base', sizePx: 56 },
  xl: { container: 'w-20 h-20', text: 'text-xl', sizePx: 80 },
};

const PASTEL_BG_COLORS = [
  'bg-[#F1F5F9] text-[#006FFF]', // Warm mocha / brand cocoa
  'bg-[#E0F2FE] text-[#0369A1]', // Soft sky
  'bg-[#FEF3C7] text-[#B45309]', // Soft amber
  'bg-[#EDE9FE] text-[#6D28D9]', // Soft violet
  'bg-[#DCFCE7] text-[#15803D]', // Soft emerald
  'bg-[#FCE7F3] text-[#BE185D]', // Soft rose
];

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'ST';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorForName(name?: string): string {
  if (!name) return PASTEL_BG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % PASTEL_BG_COLORS.length;
  return PASTEL_BG_COLORS[idx];
}

export const StaffAvatar: React.FC<StaffAvatarProps> = ({
  staffId,
  avatarUrl,
  name,
  size = 'md',
  className = '',
  alt = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const initials = getInitials(name);
  const colorClass = getColorForName(name);

  // Compute the direct authenticated image source
  const computedSrc = useMemo(() => {
    if (!avatarUrl && !staffId) return null;

    if (avatarUrl) {
      // Direct data URI or blob URI
      if (avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:')) {
        return avatarUrl;
      }

      // External absolute URL
      if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
        return avatarUrl;
      }
    }

    // Resolve API endpoint
    let baseEndpoint = '';
    if (avatarUrl && avatarUrl.startsWith('/api/')) {
      baseEndpoint = avatarUrl;
    } else if (avatarUrl) {
      baseEndpoint = `/api/staff/photo-raw/${encodeURIComponent(avatarUrl)}`;
    } else if (staffId) {
      baseEndpoint = `/api/staff/${staffId}/photo`;
    }

    if (!baseEndpoint) return null;

    const token = getAuthToken();
    const instId = getActiveInstituteId();

    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (instId) params.set('instituteId', instId);
    const qs = params.toString();

    return qs
      ? `${baseEndpoint}${baseEndpoint.includes('?') ? '&' : '?'}${qs}`
      : baseEndpoint;
  }, [avatarUrl, staffId]);

  // Reset error whenever computed source, avatarUrl, or staffId changes
  useEffect(() => {
    setHasError(false);
  }, [computedSrc, avatarUrl, staffId]);

  if (computedSrc && !hasError) {
    return (
      <img
        src={computedSrc}
        alt={alt || name || 'Staff photograph'}
        onError={() => setHasError(true)}
        className={`${sizeClass.container} rounded-2xl object-cover border border-[#E2E8F0]/80 shadow-2xs shrink-0 select-none block ${className}`}
        style={{ width: `${sizeClass.sizePx}px`, height: `${sizeClass.sizePx}px`, objectFit: 'cover' }}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${sizeClass.container} ${colorClass} rounded-2xl flex items-center justify-center font-bold tracking-tight shadow-2xs border border-[#E2E8F0]/80 shrink-0 select-none ${sizeClass.text} ${className}`}
      style={{ width: `${sizeClass.sizePx}px`, height: `${sizeClass.sizePx}px` }}
      aria-label={name || 'Staff avatar'}
      title={name || 'Staff Member'}
    >
      {initials}
    </div>
  );
};
