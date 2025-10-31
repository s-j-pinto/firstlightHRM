
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ClientSignupForm from "@/components/client-signup-form";
import { Loader2 } from 'lucide-react';

function NewClientPageContent() {
    const searchParams = useSearchParams();
    const signupId = searchParams.get('signupId');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">New Client Intake</h1>
                <p className="text-muted-foreground">
                    {signupId ? 'Editing an existing client intake form.' : 'Fill out the form below to onboard a new client.'}
                </p>
            </div>
            <ClientSignupForm signupId={signupId} mode="owner" />
        </div>
    );
}

export default function NewClientSignupPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
        <NewClientPageContent />
    </Suspense>
  );
}
