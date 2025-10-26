
"use client";

import { useState, useEffect, useTransition } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { addClientIdClaimAndGetRedirect } from '@/lib/client-auth.actions';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';

interface ClientChoice {
    id: string;
    name: string;
}

export default function ClientDashboardPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const auth = useAuth();
    const { toast } = useToast();
    const [isRedirecting, startRedirectTransition] = useTransition();

    const [clientChoices, setClientChoices] = useState<ClientChoice[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    
    const handleLogoutAndLogin = async () => {
        await signOut(auth);
        await fetch('/api/auth/session/logout', { method: 'POST' });
        router.push('/client-login');
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const tempChoices = sessionStorage.getItem('clientChoices');
            if (tempChoices) {
                 setClientChoices(JSON.parse(tempChoices));
                 // Clear it after reading so it's not reused on a page refresh
                 sessionStorage.removeItem('clientChoices');
            }
        }
    }, []);


    const handleSelectClient = async () => {
        if (!selectedClientId || !user) {
            toast({ title: 'Please select a client profile to view.', variant: 'destructive'});
            return;
        }

        startRedirectTransition(async () => {
            try {
                // Step 1: Tell the server to add the custom claim for this user
                const result = await addClientIdClaimAndGetRedirect(selectedClientId);
                if (result.error || !result.redirect) {
                    throw new Error(result.error || "Could not find the associated care log report.");
                }

                // Step 2: Force refresh the token on the client to get the new claim
                const idToken = await user.getIdToken(true);

                // Step 3: Update the session cookie on the server with the new token
                const sessionUpdateResponse = await fetch('/api/auth/session/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken }),
                });

                if (!sessionUpdateResponse.ok) {
                    throw new Error('Failed to update session.');
                }
                
                // Step 4: Redirect to the correct page
                router.push(result.redirect);

            } catch (e: any) {
                console.error("Client selection or session update error:", e);
                toast({ title: 'Error', description: e.message || 'Could not update your session. Please log in again.', variant: 'destructive'});
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
    
    if (!isUserLoading && clientChoices.length === 0) {
         return (
             <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <Card className="w-full max-w-sm text-center">
                    <CardHeader>
                        <CardTitle>Multiple Profiles Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Please log in again to select a client profile.</p>
                        <Button onClick={handleLogoutAndLogin} className="mt-4">Go to Login</Button>
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
