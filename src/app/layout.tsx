
import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { AppHeader } from '@/components/header';
import { PT_Sans } from 'next/font/google';

const ptSans = PT_Sans({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--font-pt-sans',
});


export const metadata: Metadata = {
  title: 'FirstLightHomeCare of Rancho Cucamonga',
  description: 'HRM application for First-Light Home Care',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstLight_Logo_VRT_CMYK_ICO.ico?alt=media&token=1151ccf8-5dc3-4ffd-b5aa-ca13e8b083d9" />
      </head>
      <body className={`${ptSans.variable} font-body antialiased`}>
        <FirebaseClientProvider>
          <div className="relative flex min-h-screen flex-col">
            <AppHeader />
            <div className="flex-1">{children}</div>
          </div>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
