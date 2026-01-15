
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AiCaregiverRecommendationClient } from '@/components/ai-caregiver-recommendation-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpDialog } from '@/components/HelpDialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function AiRecommendationsPageContent() {
    const searchParams = useSearchParams();
    const contactId = searchParams.get('contactId');

    if (!contactId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                    <CardDescription>No contact ID provided. Please go back and select a contact.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <Button asChild variant="outline">
                        <Link href="/admin/assessments">Back to Assessments</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle>AI Caregiver Recommendations</CardTitle>
                    <CardDescription>
                        Gemini-powered caregiver recommendations based on the client's profile and needs.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline">
                        <Link href={`/admin/initial-contact?contactId=${contactId}`}>Back to Initial Contact</Link>
                    </Button>
                    <HelpDialog topic="aiRecommendations" />
                </div>
            </CardHeader>
            <CardContent>
                <AiCaregiverRecommendationClient contactId={contactId} />
            </CardContent>
        </Card>
    );
}


export default function AiRecommendationsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>}>
            <AiRecommendationsPageContent />
        </Suspense>
    );
}
