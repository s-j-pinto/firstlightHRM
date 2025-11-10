"use client";

import { useUser } from "@/firebase";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ReferralsPage() {
  const { isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline mb-2">
            Referral Program
          </h1>
          <p className="text-muted-foreground">
            Share your code with friends and family. When they sign up, you'll earn rewards!
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/client/dashboard">
            <ArrowLeft className="mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      
      <div className="text-center py-20 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-muted-foreground">Coming Soon!</h2>
        <p className="text-muted-foreground mt-2">This feature is currently under construction.</p>
      </div>
    </div>
  );
}
