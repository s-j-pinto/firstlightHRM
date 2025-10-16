'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from 'next/navigation';
import { LogIn } from "lucide-react";
import { Button } from "./ui/button";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-background/80 backdrop-blur-sm sticky top-0 z-40 w-full border-b">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center space-x-2">
          <Image 
            src={logoUrl}
            alt="FirstLight Home Care Logo"
            width={250}
            height={40}
            priority
            className="object-contain"
          />
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            {pathname !== '/caregiver-login' && (
              <Button asChild variant="ghost">
                <Link href="/caregiver-login">
                  <LogIn className="mr-2" />
                  Apply Now
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
