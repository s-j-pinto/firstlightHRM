import type { Metadata } from 'next';
import { AppHeader } from '@/components/header';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';

export const metadata: Metadata = {
  title: 'Caregiver Connect',
  description: 'Connecting caregivers with opportunities.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <div className="relative flex min-h-screen flex-col">
          <AppHeader />
          <div className="flex-1">{children}</div>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
