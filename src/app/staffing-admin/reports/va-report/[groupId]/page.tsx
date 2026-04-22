
'use client';

import { useParams } from 'next/navigation';
import { VaReportViewer } from '@/components/va-report-viewer';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HelpDialog } from '@/components/HelpDialog';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function VaReportPage() {
    const params = useParams();
    const groupId = params.groupId as string;
    const firestore = useFirestore();

    const groupRef = useMemoFirebase(() => groupId && firestore ? doc(firestore, 'carelog_groups', groupId) : null, [groupId, firestore]);
    const { data: groupData, isLoading } = useDoc<any>(groupRef);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
            </div>
        );
    }
    
    if (!groupData) {
        return (
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold">Group Not Found</h2>
                <p className="text-muted-foreground">The requested care log group could not be found.</p>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/staffing-admin">Return to Dashboard</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">
                        VA Care Notes Report
                    </h1>
                    <p className="text-muted-foreground">
                        Client: <span className="font-semibold">{groupData.clientName}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline">
                        <Link href="/staffing-admin">
                            <ArrowLeft className="mr-2" />
                            Back to Groups
                        </Link>
                    </Button>
                    <HelpDialog topic="carelogGroups" />
                </div>
            </div>
            <VaReportViewer groupId={groupId} />
        </div>
    );
}

