'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { firestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { CareLog, CareLogGroup, Client } from '@/lib/types';
import { format, isValid } from 'date-fns';
import { Loader2, Printer, FileText } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

export default function CareLogReportPage() {
    const params = useParams();
    const groupId = params.groupId as string;

    const groupRef = useMemoFirebase(() => (groupId && firestore ? doc(firestore, 'carelog_groups', groupId) : null), [groupId, firestore]);
    const { data: group, isLoading: groupLoading } = useDoc<CareLogGroup>(groupRef);
    
    const clientRef = useMemoFirebase(() => (group && firestore ? doc(firestore, 'Clients', group.clientId) : null), [group, firestore]);
    const { data: client, isLoading: clientLoading } = useDoc<Client>(clientRef);

    const logsQuery = useMemoFirebase(() => 
        (groupId && firestore) ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', groupId), orderBy('shiftDateTime', 'desc')) : null, 
    [groupId, firestore]);
    const { data: logs, isLoading: logsLoading } = useCollection<CareLog>(logsQuery);
    
    const handlePrint = () => {
        window.print();
    };

    const isLoading = groupLoading || clientLoading || logsLoading;

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
            </div>
        );
    }
    
    if (!group) {
        return <div className="text-center py-10">Care Log Group not found.</div>;
    }

    return (
        <div className="bg-background text-foreground min-h-screen">
            <style jsx global>{`
                @media print {
                    body {
                        background-color: #fff;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-container {
                        box-shadow: none;
                        border: none;
                        padding: 0;
                    }
                }
            `}</style>
            
            <header className="no-print sticky top-0 bg-background/80 backdrop-blur-sm border-b p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">Care Log Report</h1>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print / Save as PDF
                </Button>
            </header>

            <main className="p-4 md:p-8">
                <div className="max-w-4xl mx-auto print-container">
                    <div className="p-8 border rounded-lg bg-card">
                        <header className="flex justify-between items-start pb-8 border-b mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800">Care Log Report</h1>
                                <p className="text-lg font-semibold text-accent">{client?.['Client Name']}</p>
                                <p className="text-sm text-muted-foreground">{group.clientName}</p>
                            </div>
                            <Image src={logoUrl} alt="FirstLight Home Care Logo" width={200} height={40} className="object-contain" />
                        </header>

                        <section className="space-y-6">
                            {logs && logs.length > 0 ? (
                                logs.map(log => {
                                    const shiftDate = (log.shiftDateTime as any)?.toDate();
                                    const createdDate = (log.createdAt as any)?.toDate();
                                    return (
                                        <Card key={log.id} className="bg-background/50 break-inside-avoid">
                                            <CardHeader>
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                <FileText className="text-accent" />
                                                Shift: {shiftDate && isValid(shiftDate) ? format(shiftDate, 'PPpp') : 'Date not specified'}
                                                </CardTitle>
                                                <CardDescription>
                                                Posted by {log.caregiverName} on {createdDate && isValid(createdDate) ? format(createdDate, 'PPp') : 'N/A'}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <p className="whitespace-pre-wrap text-sm">{log.logNotes}</p>
                                                {log.logImages && log.logImages.length > 0 && (
                                                    <div className="flex gap-4 pt-2">
                                                    {log.logImages.map((img, index) => (
                                                        <Image key={index} src={img} alt={`Log image ${index+1}`} width={200} height={150} className="rounded-md border object-cover" />
                                                    ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            ) : (
                                <p className="text-center text-muted-foreground py-10">No care logs found for this group.</p>
                            )}
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}