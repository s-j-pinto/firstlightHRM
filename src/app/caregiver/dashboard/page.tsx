
"use client";

import { useUser } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function CaregiverDashboardPage() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Welcome, {user?.displayName || user?.email || "Caregiver"}!
      </h1>
      <p className="text-muted-foreground">
        This is your dashboard. More features coming soon!
      </p>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Your profile information will be displayed here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
