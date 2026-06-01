import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import { Navbar } from '@/components/shared/Navbar';
import { MobileBottomNav } from '@/components/shared/MobileBottomNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'bookmyspot - Book salon appointments online',
    template: '%s | bookmyspot',
  },
  description: 'Discover trusted salons, compare services, book appointments, and manage your salon calendar from one modern platform.',
  openGraph: {
    title: 'bookmyspot',
    description: 'Premium salon discovery and appointment booking for customers, owners, and admins.',
    type: 'website',
    siteName: 'bookmyspot',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-white text-slate-900`}>
        <Providers>
          <Navbar />
          <main className='min-h-screen pb-16 md:pb-0'>{children}</main>
          <MobileBottomNav />
        </Providers>
      </body>
    </html>
  );
}
