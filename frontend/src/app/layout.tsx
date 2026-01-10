import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';
const PrivyProvider = dynamic(
  () => import('@/components/providers/PrivyProvider').then((mod) => mod.PrivyProvider),
  { ssr: false }
);
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StreamGift - Send Money Streams to Anyone',
  description: 'Stream tokens to any Twitter handle or email. Recipients claim anytime, no wallet needed.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <PrivyProvider>
            {children}
            <Toaster position="top-right" richColors />
          </PrivyProvider>
        </QueryProvider>
      </body>
    </html>
  );
}