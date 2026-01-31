"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { Loader2, Zap } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
};

export default function TimeInStageReport() {
    const profilesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_profiles')), []);
    const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesQuery);

    const interviewsQuery = useMemoFirebase(() => query(collection(firestore, 'interviews')), []);
    const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsQuery);

    const employeesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_employees')), []);
    const { data: employees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesQuery);

    const averageTimes = useMemo(() => {
        if (!profiles || !interviews || !employees) return null;

        const profilesMap = new Map(profiles.map(p => [p.id, p]));
        const interviewsMap = new Map(interviews.map(i => [i.caregiverProfileId, i]));

        let totalAppToPhone = 0, countAppToPhone = 0;
        let totalPhoneToFinal = 0, countPhoneToFinal = 0;
        let totalFinalToOrientation = 0, countFinalToOrientation = 0;
        let totalOrientationToHire = 0, countOrientationToHire = 0;

        interviews.forEach(interview => {
            const profile = profilesMap.get(interview.caregiverProfileId);
            if (!profile) return;

            const appDate = safeToDate(profile.createdAt);
            const phoneScreenDate = safeToDate(interview.createdAt);
            const finalInterviewDate = safeToDate(interview.interviewDateTime);
            const orientationDate = safeToDate(interview.orientationDateTime);
            
            if (appDate && phoneScreenDate) {
                totalAppToPhone += differenceInDays(phoneScreenDate, appDate);
                countAppToPhone++;
            }
            if (phoneScreenDate && finalInterviewDate && interview.finalInterviewStatus !== 'Pending') {
                totalPhoneToFinal += differenceInDays(finalInterviewDate, phoneScreenDate);
                countPhoneToFinal++;
            }
            if (finalInterviewDate && orientationDate && interview.finalInterviewStatus === 'Passed') {
                totalFinalToOrientation += differenceInDays(orientationDate, finalInterviewDate);
                countFinalToOrientation++;
            }
        });

        employees.forEach(employee => {
            const interview = interviewsMap.get(employee.caregiverProfileId);
            if (!interview) return;

            const orientationDate = safeToDate(interview.orientationDateTime);
            const hireDate = safeToDate(employee.hireDate);
            if (orientationDate && hireDate) {
                totalOrientationToHire += differenceInDays(hireDate, orientationDate);
                countOrientationToHire++;
            }
        });

        return {
            avgAppToPhone: countAppToPhone > 0 ? (totalAppToPhone / countAppToPhone).toFixed(1) : 'N/A',
            avgPhoneToFinal: countPhoneToFinal > 0 ? (totalPhoneToFinal / countPhoneToFinal).toFixed(1) : 'N/A',
            avgFinalToOrientation: countFinalToOrientation > 0 ? (totalFinalToOrientation / countFinalToOrientation).toFixed(1) : 'N/A',
            avgOrientationToHire: countOrientationToHire > 0 ? (totalOrientationToHire / countOrientationToHire).toFixed(1) : 'N/A',
        };
    }, [profiles, interviews, employees]);

    const isLoading = profilesLoading || interviewsLoading || employeesLoading;

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
                <CardTitle className="flex items-center gap-2"><Zap /> Candidate Time-in-Stage Analysis</CardTitle>
                <CardDescription>
                    Average number of days candidates spend between key stages of the hiring process.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {averageTimes ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="text-center"><CardHeader><CardTitle>{averageTimes.avgAppToPhone}</CardTitle><CardDescription>Application to Phone Screen</CardDescription></CardHeader></Card>
                        <Card className="text-center"><CardHeader><CardTitle>{averageTimes.avgPhoneToFinal}</CardTitle><CardDescription>Phone Screen to Final Interview</CardDescription></CardHeader></Card>
                        <Card className="text-center"><CardHeader><CardTitle>{averageTimes.avgFinalToOrientation}</CardTitle><CardDescription>Final Interview to Orientation</CardDescription></CardHeader></Card>
                        <Card className="text-center"><CardHeader><CardTitle>{averageTimes.avgOrientationToHire}</CardTitle><CardDescription>Orientation to Hire</CardDescription></CardHeader></Card>
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-10">Not enough data to calculate stage times.</p>
                )}
            </CardContent>
        </Card>
    );
}
