import React, { useState, useEffect, useMemo } from 'react';
import { getAuthToken, getActiveInstituteId } from '../services/api';

interface StudentAvatarProps {
  studentId?: string;
  photoUrl?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

const SIZE_MAP: Record<string, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]' },
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-14 h-14', text: 'text-base' },
  xl: { container: 'w-20 h-20', text: 'text-xl' },
};

const PASTEL_BG_COLORS = [
  'bg-[#F1F5F9] text-[#475569]', // Warm cocoa / mocha
  'bg-[#E0F2FE] text-[#0369A1]', // Soft sky
  'bg-[#FEF3C7] text-[#B45309]', // Soft amber
  'bg-[#EDE9FE] text-[#6D28D9]', // Soft violet
  'bg-[#DCFCE7] text-[#15803D]', // Soft emerald
  'bg-[#FCE7F3] text-[#BE185D]', // Soft rose
];

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'S';
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

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  studentId,
  photoUrl,
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
    if (!photoUrl) return null;

    // Direct data URI or blob URI
    if (photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')) {
      return photoUrl;
    }

    // External absolute URL (S3, Cloudinary, etc.)
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }

    // Resolve API endpoint
    let baseEndpoint = photoUrl;
    if (!photoUrl.startsWith('/api/')) {
      if (studentId) {
        baseEndpoint = `/api/students/${studentId}/photo`;
      } else {
        baseEndpoint = `/api/students/photo-raw/${encodeURIComponent(photoUrl)}`;
      }
    }

    const token = getAuthToken();
    const instId = getActiveInstituteId();

    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (instId) params.set('instituteId', instId);
    const qs = params.toString();

    return qs
      ? `${baseEndpoint}${baseEndpoint.includes('?') ? '&' : '?'}${qs}`
      : baseEndpoint;
  }, [photoUrl, studentId]);

  // Reset error whenever computed source, photoUrl, or studentId changes
  useEffect(() => {
    setHasError(false);
  }, [computedSrc, photoUrl, studentId]);

  if (!computedSrc || hasError) {
    return (
      <div
        className={`${sizeClass.container} rounded-full flex items-center justify-center font-bold select-none shrink-0 border border-[#E2E8F0]/60 ${colorClass} ${className}`}
        title={name || 'Student'}
      >
        <span className={sizeClass.text}>{initials}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${sizeClass.container} shrink-0 rounded-full overflow-hidden border border-[#E2E8F0] ${className}`}>
      <img
        key={computedSrc}
        src={computedSrc}
        alt={alt || name || 'Student'}
        className="w-full h-full object-cover"
        onError={() => {
          setHasError(true);
        }}
      />
    </div>
  );
};

export default StudentAvatar;
