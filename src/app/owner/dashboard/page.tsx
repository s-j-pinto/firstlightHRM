
"use client";

import { useUser } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ClientSignupList from "@/components/client-signup-list";

export default function OwnerDashboardPage() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline mb-2">
                    Welcome to the Assessment
                </h1>
                <p className="text-muted-foreground">
                    Manage new client intake forms and view their status.
                </p>
            </div>
            <Button asChild>
                <Link href="/owner/new-client-signup">
                    <UserPlus className="mr-2" />
                    Sign Up New Client
                </Link>
            </Button>
        </div>
      
      <ClientSignupList />
    </div>
  );
}
