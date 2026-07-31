import { Inter, Inter_Tight, JetBrains_Mono, Playfair_Display } from 'next/font/google'

// Geist alternative - Inter_Tight is closer to Geist
export const geistSans = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

export const geistMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

// Lyon Text alternative - Playfair Display is a nice editorial serif
export const lyonText = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-lyon-text',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})