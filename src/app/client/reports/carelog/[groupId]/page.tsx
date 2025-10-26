
"use client";

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import { firestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { CareLog, CareLogGroup } from '@/lib/types';
import { format } from 'date-fns';
import { Loader2, FileText, Calendar, Clock, User, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CareLogReportPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const groupRef = useMemoFirebase(() => groupId ? doc(firestore, 'carelog_groups', groupId) : null, [groupId]);
  const { data: groupData, isLoading: groupLoading } = useDoc<CareLogGroup>(groupRef);
  
  const logsQuery = useMemoFirebase(() => groupId ? query(collection(firestore, 'carelogs'), where('careLogGroupId', '==', groupId)) : null, [groupId]);
  const { data: logsData, isLoading: logsLoading } = useCollection<CareLog>(logsQuery);

  const sortedLogs = useMemo(() => {
    if (!logsData) return [];
    return logsData.sort((a, b) => {
      const dateA = (a.createdAt as any)?.toDate() || 0;
      const dateB = (b.createdAt as any)?.toDate() || 0;
      return dateB - dateA;
    });
  }, [logsData]);

  const isLoading = groupLoading || logsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-accent" />
      </div>
    );
  }

  if (!groupData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Report Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The care log group could not be found.</p>
            <Button asChild variant="link" className="mt-4">
              <Link href="/staffing-admin">Return to Admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <FileText className="text-accent" />
            Care Log Report
        </h1>
        <p className="text-xl text-muted-foreground mt-1">
            Client: <span className="font-semibold text-foreground">{groupData.clientName}</span>
        </p>
      </div>

      {sortedLogs.length > 0 ? (
        <div className="space-y-6">
          {sortedLogs.map(log => {
            const shiftTime = (log.shiftDateTime as any)?.toDate();
            const createdTime = (log.createdAt as any)?.toDate();
            return (
              <Card key={log.id} className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-accent" />
                      <span>{shiftTime ? format(shiftTime, 'PP') : 'Date not specified'}</span>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{shiftTime ? format(shiftTime, 'p') : 'Time not specified'}</span>
                    </div>
                  </CardTitle>
                   <CardDescription className="flex items-center gap-2 pt-1">
                     <User className="h-4 w-4" />
                     Posted by <span className="font-medium">{log.caregiverName}</span> on {createdTime ? format(createdTime, 'PPp') : 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm border-l-4 border-accent pl-4 py-2 bg-muted/50 rounded-r-md">{log.logNotes}</p>
                   {log.logImages && log.logImages.length > 0 && (
                    <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Attached Images</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {log.logImages.map((img, index) => (
                                <a key={index} href={img} target="_blank" rel="noopener noreferrer">
                                    <Image src={img} alt={`Log image ${index + 1}`} width={200} height={150} className="rounded-md border object-cover hover:opacity-80 transition-opacity" />
                                </a>
                            ))}
                        </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle>No Logs Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">There are no care logs submitted for this client group yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
