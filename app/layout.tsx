import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const barlowCond = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-cond' });

export const metadata: Metadata = {
  title: 'Vehicle Return Inspection',
  description: 'Fleet Command Centre vehicle return inspections',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#18222D' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCond.variable}`}>
      <body>{children}</body>
    </html>
  );
}
