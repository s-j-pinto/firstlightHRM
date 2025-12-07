
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
    if (!user) {
      router.replace(`/login-form?role=hr&redirect=${pathname}`);
      return;
    }
    // Only the HR admin should access this portal.
    if (user.email !== adminEmail) {
      router.replace('/admin-login'); // Redirect to a generic portal selection
    }
  }, [user, adminEmail, pathname, router]);

  // Only render children if the user is the admin
  if (user && user.email === adminEmail) {
    return <>{children}</>;
  }

  // While redirecting or for unauthorized users, show a loader
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <AdminAuthGuard>{children}</AdminAuthGuard>
      </main>
    </div>
  );
}
