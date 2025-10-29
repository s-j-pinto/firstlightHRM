
'use client';

import { useParams } from 'next/navigation';
import { useDoc, useMemoFirebase, firestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, Signature } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GeneratedForm } from '@/lib/types';
import { useForm, FormProvider } from 'react-hook-form';
import { useRef, useState, useTransition } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { submitClientSignature } from '@/lib/client-signup.actions';

const ReadOnlyFormRenderer = ({ formDefinition }: { formDefinition: GeneratedForm }) => {
    return (
        <div className="space-y-4">
            {Object.entries(formDefinition.formData).map(([key, value]) => {
                if (typeof value === 'object' && value !== null) return null; // Skip complex objects for now
                if (!value) return null; // Don't render empty fields
                
                // A simple way to format the field name for display
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                return (
                    <div key={key}>
                        <h4 className="font-semibold text-sm text-muted-foreground">{label}</h4>
                        <p className="text-md">{String(value)}</p>
                    </div>
                );
            })}
        </div>
    );
};


export default function ClientSigningPage() {
    const params = useParams();
    const signupId = params.signupId as string;
    
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const sigPadRef = useRef<SignatureCanvas>(null);
    const initialsPadRef = useRef<SignatureCanvas>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [initials, setInitials] = useState<string | null>(null);
    const [signatureDate, setSignatureDate] = useState<string>(new Date().toISOString().split('T')[0]);


    const signupRef = useMemoFirebase(() => signupId ? doc(firestore, 'client_signups', signupId) : null, [signupId]);
    const { data: signupData, isLoading } = useDoc<GeneratedForm & { status: string }>(signupRef);

    const handleSubmitSignature = () => {
        if (!signature || !initials) {
            toast({ title: "Signature and Initials Required", description: "Please provide both your signature and initials.", variant: "destructive" });
            return;
        }

        startTransition(async () => {
            const result = await submitClientSignature({
                signupId,
                signature: signature,
                initials: initials,
                date: signatureDate,
            });

            if (result.error) {
                toast({ title: "Submission Failed", description: result.message, variant: "destructive" });
            } else {
                toast({ title: "Submission Successful", description: result.message });
            }
        });
    };
    

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
            </div>
        );
    }

    if (!signupData) {
        return (
            <Card className="w-full max-w-2xl mx-auto my-8">
                <CardHeader><CardTitle>Form Not Found</CardTitle></CardHeader>
                <CardContent><p>The requested form could not be found or is no longer available.</p></CardContent>
            </Card>
        );
    }
    
    if (signupData.status === "SIGNED AND PUBLISHED") {
         return (
            <Card className="w-full max-w-2xl mx-auto my-8">
                <CardHeader>
                    <CardTitle>Document Already Signed</CardTitle>
                    <CardDescription>This document was already signed and submitted on {new Date(signupData.formData.clientSignatureDate).toLocaleDateString()}.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <p>Thank you for completing the process.</p>
                </CardContent>
            </Card>
        );
    }


    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <Card>
                <CardHeader>
                    <CardTitle>Review and Sign: {signupData.formData.formName}</CardTitle>
                    <CardDescription>Please review the information below. Your signature is required to finalize this agreement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ReadOnlyFormRenderer formDefinition={signupData} />
                </CardContent>
            </Card>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Signature Section</CardTitle>
                    <CardDescription>Please provide your signature, initials, and date below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <div className="space-y-2 p-4 border-2 border-dashed border-orange-400 rounded-lg bg-orange-50/50">
                        <Label htmlFor="client-signature" className="font-bold text-orange-600 flex items-center">
                           <Signature className="mr-2"/> Client Signature
                        </Label>
                        <div className="relative w-full h-40 rounded-md border bg-white">
                           <SignatureCanvas
                                ref={sigPadRef}
                                penColor='black'
                                canvasProps={{ id: 'client-signature', className: 'w-full h-full' }}
                                onEnd={() => setSignature(sigPadRef.current?.toDataURL() || null)}
                           />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { sigPadRef.current?.clear(); setSignature(null); }}>Clear</Button>
                    </div>

                     <div className="space-y-2 p-4 border-2 border-dashed border-orange-400 rounded-lg bg-orange-50/50">
                        <Label htmlFor="client-initials" className="font-bold text-orange-600">Client Initials</Label>
                         <div className="relative w-40 h-20 rounded-md border bg-white">
                           <SignatureCanvas
                                ref={initialsPadRef}
                                penColor='black'
                                canvasProps={{ id: 'client-initials', className: 'w-full h-full' }}
                                onEnd={() => setInitials(initialsPadRef.current?.toDataURL() || null)}
                           />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { initialsPadRef.current?.clear(); setInitials(null); }}>Clear</Button>
                    </div>

                     <div className="space-y-2 p-4 border-2 border-dashed border-orange-400 rounded-lg bg-orange-50/50">
                        <Label htmlFor="signature-date" className="font-bold text-orange-600">Date</Label>
                        <Input 
                            id="signature-date"
                            type="date" 
                            value={signatureDate}
                            onChange={(e) => setSignatureDate(e.target.value)}
                            className="w-full max-w-sm"
                        />
                    </div>
                    
                    <div className="flex justify-end pt-6">
                        <Button size="lg" onClick={handleSubmitSignature} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 animate-spin" />}
                            Submit Signature
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

