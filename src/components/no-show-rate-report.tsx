
"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Interview } from '@/lib/types';
import { Loader2, Percent, Users, UserX } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export default function NoShowRateReport() {
  const interviewsQuery = useMemoFirebase(() => query(collection(firestore, 'interviews')), []);
  const { data: interviews, isLoading } = useCollection<Interview>(interviewsQuery);

  const stats = useMemo(() => {
    if (!interviews) return { total: 0, noShows: 0, rate: 0 };

    const totalCandidatesWithOutcome = interviews.length;
    const noShows = interviews.filter(i => 
        i.finalInterviewStatus === 'No Show' || 
        i.rejectionReason === 'CG ghosted appointment'
    ).length;

    return {
      total: totalCandidatesWithOutcome,
      noShows: noShows,
      rate: totalCandidatesWithOutcome > 0 ? (noShows / totalCandidatesWithOutcome) * 100 : 0,
    };
  }, [interviews]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent /> "No Show" Candidate Rate
        </CardTitle>
        <CardDescription>
          The percentage of candidates who did not show up for their scheduled phone screen appointment.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates with Appointments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total candidates who scheduled an appointment.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">"No Show" Candidates</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noShows}</div>
             <p className="text-xs text-muted-foreground">Candidates who did not attend their appointment.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">"No Show" Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Percentage of candidates who were a "No Show".</p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
