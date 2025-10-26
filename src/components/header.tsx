
'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { Button } from "./ui/button";
import { useUser, useAuth } from "@/firebase";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  
  const auth = useAuth();
  
  const isAdminRoute = pathname.startsWith('/admin');
  const isStaffingAdminRoute = pathname.startsWith('/staffing-admin');
  const isClientRoute = pathname.startsWith('/client');


  // Hide the global header on certain routes that have their own layout/header
  if (pathname.startsWith('/caregiver') || isClientRoute) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut(auth);
    if(isAdminRoute || isStaffingAdminRoute) {
        router.push("/admin-login");
    } else {
        router.push("/");
    }
  };

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
            {isAdminRoute && user && (
               <>
                <Link href="/admin" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Dashboard
                </Link>
                <Link href="/admin/manage-interviews" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Manage Interviews
                </Link>
                <Link href="/admin/manage-applications" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Manage Applications
                </Link>
                <Link href="/admin/reports" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Reports
                </Link>
                <Link href="/admin/settings" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Settings
                </Link>
               </>
            )}
             {isStaffingAdminRoute && user && (
               <>
                <Link href="/staffing-admin" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Staffing Dashboard
                </Link>
                 <Link href="/staffing-admin/manage-clients" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Manage Clients
                </Link>
                <Link href="/staffing-admin/manage-active-caregivers" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground px-3 py-2 rounded-md">
                    Manage Active Caregivers
                </Link>
               </>
            )}
            {!user && !isUserLoading && !pathname.startsWith('/admin-login') && !pathname.startsWith('/login-form') && !pathname.startsWith('/caregiver-login') && !pathname.startsWith('/active-caregiver-login') && !pathname.startsWith('/client-login') && (
              <Button asChild variant="ghost">
                <Link href="/caregiver-login">
                  <LogIn className="mr-2" />
                  Apply Now
                </Link>
              </Button>
            )}
             {user && !isUserLoading && (
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:inline-block">
                        {user.email}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
