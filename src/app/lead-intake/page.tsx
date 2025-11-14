
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDoc, useMemoFirebase, firestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LeadIntakeForm } from '@/components/lead-intake-form';

function LeadIntakePageContent() {
  const searchParams = useSearchParams();
  const contactId = searchParams.get('id');

  const contactDocRef = useMemoFirebase(() => contactId ? doc(firestore, 'initial_contacts', contactId) : null, [contactId]);
  const { data: contactData, isLoading } = useDoc<any>(contactDocRef);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading your information...</p>
      </div>
    );
  }

  if (!contactData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error: Invalid Link</AlertTitle>
          <AlertDescription>
            The link you used is either invalid or has expired. Please contact our office if you believe this is a mistake.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (contactData.status === 'In-Home Visit Scheduled') {
       return (
          <div className="flex h-screen w-full items-center justify-center">
            <Alert className="max-w-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Assessment Already Scheduled</AlertTitle>
              <AlertDescription>
                Thank you! It looks like you have already scheduled your in-home assessment. Please check your email for the calendar invitation.
              </AlertDescription>
            </Alert>
          </div>
        );
  }

  return <LeadIntakeForm contactId={contactId!} initialData={contactData} />;
}

export default function LeadIntakePage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>}>
      <LeadIntakePageContent />
    </Suspense>
  );
}
