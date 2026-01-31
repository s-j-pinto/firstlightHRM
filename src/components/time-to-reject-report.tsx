"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { CaregiverProfile, Interview } from '@/lib/types';
import { Loader2, XCircle } from 'lucide-react';
import { differenceInDays, isDate } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const d = new Date(value);
    return isDate(d) ? d : null;
};

export default function TimeToRejectReport() {
    const profilesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_profiles')), []);
    const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesQuery);

    const interviewsQuery = useMemoFirebase(() => query(collection(firestore, 'interviews')), []);
    const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsQuery);

    const rejectionData = useMemo(() => {
        if (!profiles || !interviews) return [];

        const profilesMap = new Map(profiles.map(p => [p.id, p]));
        const reasons: { [key: string]: { totalDays: number; count: number } } = {};

        interviews.forEach(interview => {
            let rejectionDate: Date | null = null;
            let reason: string | null = null;
            
            if (interview.rejectionReason) {
                reason = interview.rejectionReason;
                rejectionDate = safeToDate(interview.rejectionDate || interview.lastUpdatedAt);
            } else if (interview.phoneScreenPassed === 'No') {
                reason = "Failed Phone Screen";
                rejectionDate = safeToDate(interview.createdAt);
            } else if (interview.finalInterviewStatus === 'Failed') {
                reason = "Failed Final Interview";
                rejectionDate = safeToDate(interview.lastUpdatedAt);
            } else if (interview.finalInterviewStatus === 'No Show') {
                reason = "No Show";
                rejectionDate = safeToDate(interview.cancelDateTime || interview.lastUpdatedAt);
            }

            if (reason && rejectionDate) {
                const profile = profilesMap.get(interview.caregiverProfileId);
                const appDate = safeToDate(profile?.createdAt);

                if (appDate) {
                    if (!reasons[reason]) {
                        reasons[reason] = { totalDays: 0, count: 0 };
                    }
                    reasons[reason].totalDays += differenceInDays(rejectionDate, appDate);
                    reasons[reason].count++;
                }
            }
        });

        return Object.entries(reasons).map(([reason, data]) => ({
            reason,
            'Avg. Days to Reject': parseFloat((data.totalDays / data.count).toFixed(1)),
        })).sort((a,b) => b['Avg. Days to Reject'] - a['Avg. Days to Reject']);

    }, [profiles, interviews]);
    
    const isLoading = profilesLoading || interviewsLoading;

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
                <CardTitle className="flex items-center gap-2"><XCircle /> Time-to-Reject Analysis</CardTitle>
                <CardDescription>
                    Average number of days from application to rejection, grouped by reason.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {rejectionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={rejectionData} layout="vertical" margin={{ left: 150 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="reason" type="category" width={200} interval={0} />
                            <Tooltip formatter={(value) => [`${value} days`, 'Average Time']} />
                            <Bar dataKey="Avg. Days to Reject" fill="#E07A5F">
                                <LabelList dataKey="Avg. Days to Reject" position="right" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-center text-muted-foreground py-10">No rejection data available to analyze.</p>
                )}
            </CardContent>
        </Card>
    );
}
