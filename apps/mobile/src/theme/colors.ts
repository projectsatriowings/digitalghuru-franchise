/**
 * Digital Guru Franchise Mobile Brand & Role Color System
 * Adheres strictly to established enterprise tokens and role visual personalities.
 */

export const brandColors = {
  // Official Digital Guru Core Palette
  navy: '#0F172A',         // Primary Ink / Deep Background
  deepNavy: '#0A2540',     // Enterprise Container
  blue: '#006FFF',         // Primary Action Blue
  gold: '#FEDC32',         // Highlight Yellow / Gold
  orange: '#FE4D01',       // Teacher / Urgent Action Accent

  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',

  // Status Indicators
  success: '#10B981',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  
  error: '#EF4444',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  
  info: '#006FFF',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
};

export const roleThemes = {
  STUDENT: {
    roleName: 'Student',
    primary: brandColors.blue,
    secondary: brandColors.gold,
    accent: brandColors.blue,
    cardBackground: '#FFFFFF',
    surfaceVariant: '#EFF6FF',
    badgeBg: '#DBEAFE',
    badgeText: '#1D4ED8',
    gradient: ['#006FFF', '#0284C7'],
    tagline: 'Your Learning Journey',
  },
  PARENT: {
    roleName: 'Parent',
    primary: brandColors.navy,
    secondary: brandColors.gold,
    accent: brandColors.blue,
    cardBackground: '#FFFFFF',
    surfaceVariant: '#F8FAFC',
    badgeBg: '#E2E8F0',
    badgeText: '#0F172A',
    gradient: ['#0F172A', '#1E293B'],
    tagline: 'Child Progress & Academics',
  },
  STAFF: {
    roleName: 'Teacher',
    primary: brandColors.deepNavy,
    secondary: brandColors.orange,
    accent: brandColors.orange,
    cardBackground: '#FFFFFF',
    surfaceVariant: '#FFF7ED',
    badgeBg: '#FFEDD5',
    badgeText: '#C2410C',
    gradient: ['#0A2540', '#1E3A5F'],
    tagline: 'Classroom & Attendance Portal',
  },
};
