
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { Loader2, LogOut } from "lucide-react";
import Image from "next/image";

import { useUser, useAuth } from "@/firebase";
import { Button } from "@/components/ui/button";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

export default function NewClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/new-client-login");
  };

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace(`/new-client-login?redirect=${pathname}`);
    }
  }, [isUserLoading, user, router, pathname]);


  if (isUserLoading || !user) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
         <Link
            href="/new-client/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
             <Image 
              src={logoUrl}
              alt="FirstLight Home Care Logo"
              width={180}
              height={30}
              priority
              className="object-contain"
            />
          </Link>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className="ml-auto flex-1 sm:flex-initial flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/20">
        {children}
      </main>
    </div>
  );
}
