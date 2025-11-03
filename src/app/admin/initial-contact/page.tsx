'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InitialContactForm } from '@/components/initial-contact-form';
import { Loader2 } from 'lucide-react';

function InitialContactPageContent() {
    const searchParams = useSearchParams();
    const contactId = searchParams.get('contactId');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Initial Phone Contact</h1>
                <p className="text-muted-foreground">
                    {contactId ? 'Editing an existing initial contact record.' : 'Fill out the form below to document a new client inquiry.'}
                </p>
            </div>
            <InitialContactForm contactId={contactId} />
        </div>
    );
}

export default function InitialContactPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
        <InitialContactPageContent />
    </Suspense>
  );
}
