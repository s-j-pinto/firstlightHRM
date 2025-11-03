'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ClientSignupForm from "@/components/client-signup-form";
import { Loader2 } from 'lucide-react';
import { InitialContactForm } from '@/components/initial-contact-form';


function NewClientPageContent() {
    const searchParams = useSearchParams();
    const signupId = searchParams.get('signupId');

    // This check is a simple way to route to the correct form.
    // In a real app, you might have a more complex state management.
    if (!signupId) {
        return (
             <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Initial Phone Contact</h1>
                    <p className="text-muted-foreground">
                        Fill out the form below to document a new client inquiry.
                    </p>
                </div>
                <InitialContactForm contactId={null} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">New Client Intake Assessment</h1>
                <p className="text-muted-foreground">
                    Editing an existing client intake form.
                </p>
            </div>
            <ClientSignupForm signupId={signupId} />
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
