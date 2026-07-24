import type { Config } from 'tailwindcss';

/**
 * Invoice SaaS design system — "Confident Indigo".
 *
 * A B2B invoicing tool that moves money needs three things at once:
 *  - TRUST   → navy ink (`brand`) for structure, headings, the shell.
 *  - MONEY   → emerald (`accent`) for paid / success / the positive story.
 *  - PLAY    → indigo (`cta`) for every interactive accent: primary buttons,
 *              active nav, links, focus rings, hover energy.
 *
 * Fonts: Plus Jakarta Sans (friendly, enterprise-legible) + JetBrains Mono for
 * figures. Motion: 150–300ms, transform/opacity only, reduced-motion aware.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // Class-based dark mode — toggled via `.dark` on <html> (ThemeProvider + no-flash script).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — navy ink. Reuses the old `brand` name so existing usages render navy.
        brand: {
          50: '#eef2f8',
          100: '#dbe3ee',
          200: '#b8c6da',
          300: '#8fa3c4',
          400: '#6782ae',
          500: '#41618f',
          600: '#1E3A5F', // primary navy
          700: '#18304f',
          800: '#12243b',
          900: '#0B1626',
        },
        // CTA — indigo. The playful, interactive accent (buttons, nav, links, focus).
        cta: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Accent — emerald. Money / paid / success only (semantic, never decorative).
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669', // paid / success
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#053b2c',
        },
        // Semantic status colors (invoice lifecycle).
        success: '#059669',
        danger: '#e11d48',
        // Neutral surface tokens — RGB channels so Tailwind alpha modifiers work.
        // Flipped under `.dark` in globals.css.
        surface: {
          bg: 'rgb(var(--surface-card) / <alpha-value>)',
          fg: 'rgb(var(--surface-fg) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
        },
      },
      backgroundImage: {
        'cta-gradient': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        'cta-gradient-soft': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'mesh': 'radial-gradient(60% 60% at 15% 10%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(50% 50% at 90% 20%, rgba(16,185,129,0.14) 0%, transparent 55%), radial-gradient(60% 60% at 50% 100%, rgba(30,58,95,0.12) 0%, transparent 60%)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.05)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 6px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 12px 28px -8px rgba(15, 23, 42, 0.18), 0 4px 10px rgba(15, 23, 42, 0.08)',
        md: '0 4px 6px rgba(15, 23, 42, 0.10)',
        lg: '0 10px 15px rgba(15, 23, 42, 0.10)',
        xl: '0 20px 25px rgba(15, 23, 42, 0.15)',
        'cta': '0 8px 20px -6px rgba(79, 70, 229, 0.45)',
        'cta-sm': '0 4px 12px -4px rgba(79, 70, 229, 0.4)',
        'focus-cta': '0 0 0 3px rgba(99, 102, 241, 0.35)',
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'page-enter': 'page-enter 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-up': 'fade-in-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pop': 'pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'float': 'float 6s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 8s ease infinite',
      },
    },
  },
  plugins: [],
};

export default config;
