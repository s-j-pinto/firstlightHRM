
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUser } from "@/firebase";

function OwnerAuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL||"lpinto@firstlighthomecare.com";

  useEffect(() => {
    if (!user || user.email !== ownerEmail) {
      router.replace(`/owner-login?redirect=${pathname}`);
    }
  }, [user, ownerEmail, pathname, router]);

  if (user && user.email === ownerEmail) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-accent" />
    </div>
  );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
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
        <OwnerAuthGuard>{children}</OwnerAuthGuard>
      </main>
    </div>
  );
}
