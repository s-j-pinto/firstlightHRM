
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUser } from "@/firebase";

function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUser(); // isUserLoading is already false here
  const router = useRouter();
  const pathname = usePathname();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";

  useEffect(() => {
    if (!user || user.email !== adminEmail) {
      router.replace(`/login-form?redirect=${pathname}`);
    }
  }, [user, adminEmail, pathname, router]);

  // Only render children if the user is the admin
  if (user && user.email === adminEmail) {
    return <>{children}</>;
  }

  // While redirecting, show a loader
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isUserLoading } = useUser();

  // State 1: While user status is being determined, show a full-page loader.
  // This is the most critical part to prevent race conditions.
  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  // State 2: Auth status is resolved. Pass control to the guard.
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <AdminAuthGuard>{children}</AdminAuthGuard>
      </main>
    </div>
  );
}
