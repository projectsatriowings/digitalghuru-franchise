/**
 * Digital Guru Franchise Enterprise Shared Design System Tokens
 * Source of truth for Branding, Web (Tailwind/CSS), and Multi-Tenant Franchise Theming.
 */

export const digitalGuruBrand = {
  name: 'Digital Guru Franchise',
  companyName: 'Digital Ghuru',
  tagline: 'Agency-Style Learning & Franchise Enterprise',
  colors: {
    blue: '#006FFF',      // Primary Brand Blue
    gold: '#FEDC32',      // Accent Brand Gold/Yellow
    orange: '#FE4D01',    // Accent Brand Orange
    navy: '#0F172A',      // Ink 900
    slate: '#1E293B',     // Ink 800
    light: '#F8FAFC',     // Surface Light
  },
  typography: {
    display: 'Outfit, sans-serif',
    body: 'Inter, sans-serif',
  },
  contact: {
    phone: '+91 8825948859',
    email: 'contact@digitalghuru.com',
    campuses: [
      {
        name: 'Anna Nagar Office',
        city: 'Chennai',
        address: '45, A Block, 3rd Avenue, Kumaran Nagar, Anna Nagar East, Chennai - 600102',
        phone: '+91 8825948859',
      },
      {
        name: 'Ameerpet Office',
        city: 'Hyderabad',
        address: 'F8, First Floor, Kallu Compound Rd, Pratap Nagar, Nagarjuna Nagar colony, Yella Reddy Guda, Ameerpet, Hyderabad - 500073',
        phone: '+91 8825948859',
      },
      {
        name: 'Korattur Office',
        city: 'Chennai',
        address: '2nd Floor, No. 1A, "Gurudev Complex", S1, 57th St, Venkatraman Nagar, Korattur, Chennai 600050',
        phone: '+91 8825948859',
      },
    ],
    social: {
      facebook: 'https://www.facebook.com/share/1D1vTjqQWX/',
      instagram: 'https://www.instagram.com/digitalghuru?igsi=MWlqanV6MnZ4cW1vYg==',
      linkedin: 'https://linkedin.com/company/digitalghuru',
      twitter: 'https://x.com/digital_ghuru?s=20',
    },
    collaboration: {
      partnerName: 'Jaighurudeva Educational Academy',
      partnerUrl: 'https://jaighurudeva.in/',
    },
  },
};

export const themeTokens = {
  colors: {
    // Official Digital Guru Brand Palette
    brandBlue: '#006FFF',
    brandGold: '#FEDC32',
    brandOrange: '#FE4D01',
    brandNavy: '#0F172A',

    // Core Brand Neutrals & Surfaces
    espresso: '#0F172A',
    cocoa: '#1E293B',
    primary: '#006FFF',
    taupe: '#334155',
    mocha: '#64748B',
    greige: '#94A3B8',
    beige: '#E2E8F0',
    
    // Surfaces & Backgrounds
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    
    // Text Hierarchy
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    textLight: '#FFFFFF',
    textLightMuted: '#E2E8F0',
    
    // Status & Semantic Colors
    success: '#15803D',
    successBg: '#F0FDF4',
    successBorder: '#BBF7D0',
    
    warning: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    
    error: '#B91C1C',
    errorBg: '#FEF2F2',
    errorBorder: '#FECACA',
    
    info: '#006FFF',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 9999,
  },
  
  typography: {
    fontFamily: 'Outfit, Inter, sans-serif',
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 18,
      xl: 20,
      xxl: 24,
      title: 28,
    },
    weights: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      black: '800' as const,
    },
  },
  
  shadows: {
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardHover: {
      shadowColor: '#006FFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 5,
    },
    modal: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 10,
    },
  },
};
