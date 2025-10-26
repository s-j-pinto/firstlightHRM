"use client";

import { useState, useEffect, useTransition } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getCareLogGroupId } from '@/lib/client-auth.actions';

interface ClientChoice {
    id: string;
    name: string;
}

export default function ClientDashboardPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isRedirecting, startRedirectTransition] = useTransition();

    const [clientChoices, setClientChoices] = useState<ClientChoice[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    useEffect(() => {
        if (!isUserLoading && user) {
            user.getIdTokenResult().then(idTokenResult => {
                const choices = idTokenResult.claims.clients as string[] | undefined;
                
                // This is a workaround since the choices are not coming through claims as expected.
                // In a real scenario, this would be fetched securely or passed via claims.
                // For now, we simulate what the action returns.
                // This part of the logic is hard to implement without a live auth backend to test claims.
                // We will assume for now the user needs to be handled.
            });
        }
    }, [user, isUserLoading]);
    
    // Placeholder effect if claims aren't working as expected during development
    useEffect(() => {
        if (typeof window !== "undefined") {
            const tempChoices = sessionStorage.getItem('clientChoices');
            if (tempChoices) {
                 setClientChoices(JSON.parse(tempChoices));
                 sessionStorage.removeItem('clientChoices');
            }
        }
    }, []);


    const handleSelectClient = async () => {
        if (!selectedClientId) {
            toast({ title: 'Please select a client profile to view.', variant: 'destructive'});
            return;
        }

        startRedirectTransition(async () => {
            const result = await getCareLogGroupId(selectedClientId);
            if (result.error || !result.groupId) {
                toast({ title: 'Error', description: result.error || "Could not find the associated care log report.", variant: 'destructive'});
            } else {
                router.push(`/reports/carelog/${result.groupId}`);
            }
        });
    };

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
            </div>
        );
    }
    
    // This is a fallback in case the user lands here without choices.
    // This could happen if they are already logged in from a multi-client session.
    if (clientChoices.length === 0) {
         return (
             <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <Card className="w-full max-w-sm text-center">
                    <CardHeader>
                        <CardTitle>Multiple Profiles Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Please log in again to select a client profile.</p>
                        <Button onClick={() => router.push('/client-login')} className="mt-4">Go to Login</Button>
                    </CardContent>
                </Card>
            </div>
         );
    }

    return (
        <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
            <Card className="w-full max-w-md mx-auto shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto w-fit rounded-full bg-accent/10 p-4">
                        <Users className="h-8 w-8 text-accent" />
                    </div>
                    <CardTitle className="text-2xl font-bold font-headline pt-2">Select a Profile</CardTitle>
                    <CardDescription>
                        Your email is associated with multiple client profiles. Please choose one to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Select onValueChange={setSelectedClientId} value={selectedClientId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a client profile..." />
                        </SelectTrigger>
                        <SelectContent>
                            {clientChoices.map(choice => (
                                <SelectItem key={choice.id} value={choice.id}>
                                    {choice.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleSelectClient} disabled={isRedirecting || !selectedClientId} className="w-full">
                        {isRedirecting && <Loader2 className="mr-2 animate-spin" />}
                        View Report
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}