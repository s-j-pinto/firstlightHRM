"use client";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';

function ConfirmationPageContent() {
  const searchParams = useSearchParams();
  const time = searchParams.get('time');
  const appointmentTime = time ? new Date(time) : new Date();

  return (
    <main className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-lg mx-auto my-8 animate-in fade-in-50 duration-500 shadow-lg">
        <CardHeader className="items-center text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <CardTitle className="text-3xl font-bold font-headline">Appointment Confirmed!</CardTitle>
            <CardDescription>Your interview has been successfully scheduled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg space-y-4 bg-background/50">
             <p className="flex items-start">
                <Calendar className="h-5 w-5 mr-3 mt-1 text-accent flex-shrink-0" />
                <span className="font-semibold">{format(appointmentTime, 'EEEE, MMMM do, yyyy')}</span>
            </p>
            <p className="flex items-start">
                <Clock className="h-5 w-5 mr-3 mt-1 text-accent flex-shrink-0" />
                <span className="font-semibold">{format(appointmentTime, 'h:mm a')}</span>
            </p>
             <p className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 mt-1 text-accent flex-shrink-0" />
                <span className="font-semibold">9650 Business Center Drive, Suite 132, Rancho Cucamonga, CA</span>
            </p>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            You will receive a confirmation email with all the details shortly. We look forward to meeting you!
          </p>
          <div className="text-center pt-2">
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
        <Suspense fallback={<div>Loading...</div>}>
            <ConfirmationPageContent />
        </Suspense>
    )
}