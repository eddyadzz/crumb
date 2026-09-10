import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { SwRegister } from '@/components/sw-register';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Crumb — From Recipe to Profit',
  description:
    'Food production and profitability platform for home bakers, cottage food operators, and small food businesses.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Crumb',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FF7A1A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${display.variable} font-sans no-tap-highlight`}
      >
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
