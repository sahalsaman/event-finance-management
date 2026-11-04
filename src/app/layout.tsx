import type { Metadata, Viewport } from 'next';
import { SplashScreen } from '@/components/SplashScreen';
import './globals.css';

export const metadata: Metadata = {
  title: 'SSF Mukkam Finance',
  description: 'Mobile-first event income and expense tracker',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#115b3c',
};
export const instant = false;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Noto+Serif+Malayalam:wght@700&family=Playfair+Display:ital,wght@0,500;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
