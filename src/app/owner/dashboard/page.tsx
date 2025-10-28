
"use client";

import { useUser } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight font-headline mb-2">
        Welcome, Owner!
      </h1>
      <p className="text-muted-foreground mb-8">
        This is your owner dashboard.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle>Owner Dashboard</CardTitle>
          <CardDescription>
            High-level overview and controls will be displayed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>More features coming soon!</p>
        </CardContent>
      </Card>
    </div>
  );
}
