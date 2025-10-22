
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useUser } from "@/firebase";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";

  useEffect(() => {
    // Don't do anything while auth state is loading
    if (isUserLoading) {
      return;
    }
    // If loading is finished and there's no user or it's the wrong user, redirect
    if (!user || user.email !== adminEmail) {
        router.replace(`/login?redirect=${pathname}`);
    }
  }, [isUserLoading, user, router, pathname, adminEmail]);

  // While loading, or if the user is not the admin (and redirect is in flight), show a loader.
  if (isUserLoading || !user || user.email !== adminEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }
  
  // Only render the children if the user is authenticated and is the admin
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
