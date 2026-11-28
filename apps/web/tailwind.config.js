/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#006FFF",
          gold: "#FEDC32",
          orange: "#FE4D01",
          50: '#F0F7FF',
          100: '#E0EFFF',
          200: '#BAE0FF',
          300: '#7CC4FF',
          400: '#38A3FF',
          500: '#006FFF',
          600: '#0058D4',
          700: '#0042A6',
          800: '#003078',
          900: '#0F172A',
          950: '#020617',
        },
        ink: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        espresso: '#0F172A',
        cocoa: '#1E293B',
        'warm-brown': '#006FFF',
        taupe: '#334155',
        mocha: '#64748B',
        greige: '#94A3B8',
        beige: '#E2E8F0',
        'off-white': '#F8FAFC',
        ivory: '#FFFFFF',
      },
      fontFamily: {
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        heading: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        xs: ['0.84rem', { lineHeight: '1.3rem' }],      // ~13.5px (readable software captions/badges)
        sm: ['0.9375rem', { lineHeight: '1.45rem' }],   // 15px (comfortable software body/table/buttons)
        base: ['1rem', { lineHeight: '1.55rem' }],      // 16px (standard input/prose size)
        lg: ['1.15rem', { lineHeight: '1.75rem' }],     // ~18.5px (section headings)
        xl: ['1.35rem', { lineHeight: '1.85rem' }],     // ~21.5px (card titles/subheaders)
        '2xl': ['1.65rem', { lineHeight: '2.1rem' }],   // ~26.5px (page titles)
        '3xl': ['2rem', { lineHeight: '2.45rem' }],     // 32px (hero/KPI numbers)
      },
    },
  },
  plugins: [],
};
