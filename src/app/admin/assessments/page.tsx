"use client";

import { useUser } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ClientSignupList from "@/components/client-signup-list";

export default function AssessmentsPage() {
  const { isUserLoading } = useUser();

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
                    Client Assessments
                </h1>
                <p className="text-muted-foreground">
                    Manage new client intake forms and view their status.
                </p>
            </div>
            <Button asChild>
                <Link href="/admin/initial-contact">
                    <Phone className="mr-2" />
                    New Initial Contact
                </Link>
            </Button>
        </div>
      
      <ClientSignupList />
    </div>
  );
}
