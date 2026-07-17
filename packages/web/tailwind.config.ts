import type { Config } from 'tailwindcss';

/**
 * Invoice SaaS design system — "Soft UI Evolution".
 * Primary = navy #1E3A5F, CTA accent = paid-green #059669, over a calm slate neutral
 * scale. Semantic status colors follow the invoice lifecycle. Fonts: Calistoga
 * (headings) + Inter (body) + JetBrains Mono (numbers). Shadows are soft and modern.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  // Class-based dark mode — toggled via `.dark` on <html> (see ThemeProvider + the
  // no-flash script in layout.tsx).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary — navy. Reuses the old `brand` name so existing usages render navy.
        brand: {
          50: '#eef2f7',
          100: '#dbe3ee',
          200: '#b8c6da',
          300: '#8fa3c4',
          400: '#6782ae',
          500: '#41618f',
          600: '#1E3A5F', // primary
          700: '#18304f',
          800: '#12243b',
          900: '#0c1828',
        },
        // CTA accent — paid-green. 300/950 are the dark-mode text/badge shades.
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7', // light emerald (dark-mode text)
          500: '#10b981',
          600: '#059669', // CTA
          700: '#047857',
          900: '#065f46', // deep emerald (dark-mode ring)
          950: '#053b2c', // deep emerald (dark-mode badge bg)
        },
        // Semantic status colors (invoice lifecycle).
        success: '#059669',
        danger: '#DC2626',
        // Neutral surface tokens — RGB channels so Tailwind alpha modifiers
        // (e.g. bg-surface-bg/80) work. Flipped under `.dark` in globals.css.
        surface: {
          bg: 'rgb(var(--surface-card) / <alpha-value>)',
          fg: 'rgb(var(--surface-fg) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
        },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.05)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 6px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 8px 16px rgba(15, 23, 42, 0.10)',
        md: '0 4px 6px rgba(15, 23, 42, 0.10)',
        lg: '0 10px 15px rgba(15, 23, 42, 0.10)',
        xl: '0 20px 25px rgba(15, 23, 42, 0.15)',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Calistoga', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
