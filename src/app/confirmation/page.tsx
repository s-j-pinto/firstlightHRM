"use client";
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

function ConfirmationPageContent() {
  const [receivedTime, setReceivedTime] = useState<string>('');

  useEffect(() => {
    // Capture the current date and time on the client side to avoid hydration mismatches.
    setReceivedTime(format(new Date(), 'PPp'));
  }, []);

  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-lg mx-auto my-8 animate-in fade-in-50 duration-500 shadow-lg">
        <CardHeader className="items-center text-center pb-2">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <CardTitle className="text-2xl font-bold font-headline">Appointment To Be Confirmed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <p className="text-center text-muted-foreground leading-relaxed px-4">
            FirstLight Administrator has received your application on <span className="font-semibold text-foreground">{receivedTime || '...'}</span> along with your preferred time slots for a phone interview. We will send you a calendar invite after reviewing your application. Thanks
          </p>
          <div className="text-center pt-4">
            <Button asChild variant="outline">
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ConfirmationPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <ConfirmationPageContent />
        </Suspense>
    )
}
