
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, firestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ClientSignupForm from '@/components/client-signup-form';


export default function ClientSigningPage() {
    const params = useParams();
    const router = useRouter();
    const signupId = params.signupId as string;

    const signupRef = useMemoFirebase(() => signupId ? doc(firestore, 'client_signups', signupId) : null, [signupId]);
    const { data: signupData, isLoading } = useDoc<any>(signupRef);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
            </div>
        );
    }

    if (!signupData) {
        return (
             <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <Card className="w-full max-w-2xl mx-auto my-8">
                    <CardHeader>
                        <CardTitle>Form Not Found</CardTitle>
                        <CardDescription>The requested form could not be found, may have been completed, or is no longer available.</CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    if (signupData.status === 'SIGNED AND PUBLISHED' || signupData.status === 'CLIENT_SIGNATURES_COMPLETED') {
        router.replace('/new-client/dashboard'); // Redirect to dashboard if already done.
        return (
             <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Review and Sign Document</h1>
                <p className="text-muted-foreground">
                    Please review the information below and complete the required signature fields.
                </p>
            </div>
            <ClientSignupForm signupId={signupId} mode="client-signing" />
        </div>
    );
}
