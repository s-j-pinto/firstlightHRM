
'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import ClientSignupForm from "@/components/client-signup-form";
import { Loader2 } from 'lucide-react';

function PrintFormPageContent() {
    const params = useParams();
    const signupId = params.signupId as string;

    if (!signupId) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p>No document ID provided.</p>
            </div>
        );
    }

    return <ClientSignupForm signupId={signupId} mode="print" />;
}

export default function PrintClientFormPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>}>
            <PrintFormPageContent />
        </Suspense>
    );
}
