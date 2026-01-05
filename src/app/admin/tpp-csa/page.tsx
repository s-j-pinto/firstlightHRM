
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TppCsaForm from "@/components/tpp-csa-form";
import { Loader2 } from 'lucide-react';

function TppCsaPageContent() {
    const searchParams = useSearchParams();
    const signupId = searchParams.get('signupId');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">New Third Party Payor CSA</h1>
                <p className="text-muted-foreground">
                    {signupId ? 'Editing an existing TPP agreement.' : 'Fill out the form below to onboard a new client with a third party payor.'}
                </p>
            </div>
            <TppCsaForm signupId={signupId} mode="owner" />
        </div>
    );
}

export default function TppCsaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
        <TppCsaPageContent />
    </Suspense>
  );
}
