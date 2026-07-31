import type { Config } from 'tailwindcss';

/**
 * Invoice SaaS — taste-skill v2 redesign
 *
 * Two vibes, one project:
 *   - Soft Structuralism (dashboard, list, settings, clients, subscriptions, isolation)
 *   - Editorial Luxury (invoice detail, new invoice)
 *
 * Dials: DESIGN_VARIANCE=8 | MOTION_INTENSITY=7 | VISUAL_DENSITY=5
 * Fonts: Geist Sans (body) + Lyon Text (headings) + Geist Mono (numbers)
 * Motion: GSAP + ScrollTrigger (scroll), Framer Motion (UI)
 * Icons: Phosphor (one family)
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Warm Monochrome (Soft Structuralism base) ────────────────────────
        stone: {
          50: '#F7F6F3',   // page background (light)
          100: '#EAEAEA',  // borders, dividers
          200: '#D4D4D4',  // muted borders
          300: '#A3A3A3',  // disabled text
          400: '#737373',  // placeholder text
          500: '#525252',  // secondary text
          600: '#404040',  // body text (light)
          700: '#2F3437',  // body text (light) — #2F3437 per spec
          800: '#1A1A1A',  // heading text (light)
          900: '#111111',  // primary text (light) — #111111 per spec
          950: '#0A0A0A',  // near black
        },
        // Dark mode warm monochrome
        darkStone: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#2F2F2F',  // card bg
          900: '#1C1C1C',  // surface bg
          950: '#0F0F0F',  // page bg
        },
        // ── Desaturated Semantic Pastels (flattened for opacity modifiers) ──
        'pastel-red': {
          50: '#FEF2F2',
          100: '#FDECEC',
          200: '#FBDDDD',
          300: '#F5BABA',
          400: '#E89999',
          500: '#E89999',  // badge bg
          600: '#D47777',  // badge text
          700: '#B85555',
          800: '#9D3F3F',
          900: '#7A2E2E',
          950: '#421313',
        },
        'pastel-blue': {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#60A5FA',  // badge bg
          600: '#3B82F6',  // badge text
          700: '#2563EB',
          800: '#1D4ED8',
          900: '#1E3A5F',
          950: '#172554',
        },
        'pastel-green': {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#34D399',  // badge bg (paid)
          600: '#059669',  // badge text
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#052E21',
        },
        'pastel-yellow': {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#FBBF24',  // badge bg (overdue)
          600: '#D97706',  // badge text
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        // ── Editorial Luxury warm cream (invoice detail, new invoice) ─────────
        cream: {
          50: '#FDFBF7',   // page bg
          100: '#FAF6ED',  // card bg
          200: '#F0EAD6',  // border
          300: '#E6DBC4',  // muted
          400: '#DCC9A8',
          500: '#D2B88C',
          600: '#C4A06E',
          700: '#A88856',
          800: '#8C7042',
          900: '#705834',
        },
        // Semantic aliases for backwards compat
        success: '#059669',
        danger: '#E89999',
        accent: '#059669',
        cta: '#111111',
      },
      backgroundImage: {
        // Soft Structuralism: subtle radial blobs
        'blob-primary': 'radial-gradient(60% 60% at 15% 10%, rgba(17,17,17,0.03) 0%, transparent 60%), radial-gradient(50% 50% at 90% 20%, rgba(17,17,17,0.02) 0%, transparent 55%)',
        'blob-dark': 'radial-gradient(60% 60% at 15% 10%, rgba(255,255,255,0.02) 0%, transparent 60%), radial-gradient(50% 50% at 90% 20%, rgba(255,255,255,0.015) 0%, transparent 55%)',
        // Editorial Luxury: warm mesh
        'cream-mesh': 'radial-gradient(60% 60% at 15% 10%, rgba(210,184,140,0.15) 0%, transparent 60%), radial-gradient(50% 50% at 90% 20%, rgba(210,184,140,0.1) 0%, transparent 55%)',
        // Noise overlay for fixed elements
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.02'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        // Double-bezel system
        'bezel-sm': '0 1px 2px rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.04)',
        'bezel': '0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)',
        'bezel-lg': '0 4px 16px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.06)',
        'bezel-xl': '0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.07)',
        // Card hover lift
        'lift-sm': '0 2px 8px rgba(0,0,0,0.04)',
        'lift': '0 4px 12px rgba(0,0,0,0.05)',
        'lift-lg': '0 8px 20px rgba(0,0,0,0.06)',
        // Glass overlay
        'glass': '0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.1)',
        'glass-dark': '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
        // Focus ring (taste-skill style)
        'focus-ring': '0 0 0 2px rgba(17,17,17,0.15), 0 0 0 4px rgba(17,17,17,0.1)',
        'focus-ring-dark': '0 0 0 2px rgba(255,255,255,0.1), 0 0 0 4px rgba(255,255,255,0.05)',
      },
      borderRadius: {
        // Double-bezel radius system
        'outer': '2rem',           // --radius-outer
        'inner': 'calc(2rem - 0.375rem)', // --radius-inner
        'pill': '9999px',          // button-in-button CTA
        'badge': '9999px',         // pastel pill tags
        lg: '0.75rem',             // 12px
        xl: '1rem',                // 16px
        '2xl': '1.5rem',           // 24px
        '3xl': '2rem',             // 32px
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        heading: ['var(--font-lyon-text)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Editorial typography scale
        'display-xl': ['clamp(3rem, 8vw, 6rem)', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['clamp(2rem, 4vw, 3.5rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-sm': ['clamp(1.5rem, 3vw, 2.5rem)', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-xl': ['clamp(1.875rem, 2.5vw, 2.25rem)', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-lg': ['clamp(1.5rem, 2vw, 1.875rem)', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-md': ['clamp(1.25rem, 1.5vw, 1.5rem)', { lineHeight: '1.35', letterSpacing: '0', fontWeight: '600' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
      },
      transitionTimingFunction: {
        // taste-skill cubic-bezier
        taste: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'taste-slow': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        'taste': '700ms',
        'taste-slow': '1000ms',
      },
      keyframes: {
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'modal-overlay-enter': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'modal-content-enter': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.96)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'skeleton-shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'blob-drift': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(30px, -30px) rotate(120deg)' },
          '66%': { transform: 'translate(-20px, 20px) rotate(240deg)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 600ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'fade-in-up': 'fade-in-up 700ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'scale-in': 'scale-in 400ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'modal-overlay-enter': 'modal-overlay-enter 400ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'modal-content-enter': 'modal-content-enter 500ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'skeleton-shimmer': 'skeleton-shimmer 2s ease-in-out infinite',
        'blob-drift': 'blob-drift 20s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;