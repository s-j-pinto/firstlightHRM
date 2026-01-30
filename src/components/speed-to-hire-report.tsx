"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { Loader2, Zap } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from './ui/badge';

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

export default function SpeedToHireReport() {
    const profilesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_profiles')), []);
    const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesQuery);

    const interviewsQuery = useMemoFirebase(() => query(collection(firestore, 'interviews')), []);
    const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsQuery);

    const employeesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_employees')), []);
    const { data: employees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesQuery);

    const hiringMetrics = useMemo(() => {
        if (!employees || !interviews || !profiles) return [];
        
        const profilesMap = new Map(profiles.map(p => [p.id, p]));
        const interviewsMap = new Map(interviews.map(i => [i.caregiverProfileId, i]));

        return employees.map(employee => {
            const profile = profilesMap.get(employee.caregiverProfileId);
            const interview = interviewsMap.get(employee.caregiverProfileId);

            if (!profile || !interview) return null;

            const applicationDate = safeToDate(profile.createdAt);
            const phoneScreenDate = safeToDate(interview.createdAt);
            const finalInterviewDate = safeToDate(interview.interviewDateTime);
            const orientationDate = safeToDate(interview.orientationDateTime);
            const hireDate = safeToDate(employee.hireDate);

            const metrics = {
                name: profile.fullName,
                appToPhone: (applicationDate && phoneScreenDate) ? differenceInDays(phoneScreenDate, applicationDate) : null,
                phoneToFinal: (phoneScreenDate && finalInterviewDate) ? differenceInDays(finalInterviewDate, phoneScreenDate) : null,
                finalToOrientation: (finalInterviewDate && orientationDate) ? differenceInDays(orientationDate, finalInterviewDate) : null,
                orientationToHire: (orientationDate && hireDate) ? differenceInDays(hireDate, orientationDate) : null,
                totalTime: (applicationDate && hireDate) ? differenceInDays(hireDate, applicationDate) : null,
            };

            return metrics;
        }).filter(Boolean).sort((a, b) => (b!.totalTime || -1) - (a!.totalTime || -1));

    }, [employees, interviews, profiles]);

    const isLoading = profilesLoading || interviewsLoading || employeesLoading;

    if (isLoading) {
        return (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        );
    }
    
    const calculateAverages = () => {
        const validMetrics = hiringMetrics.filter(m => m !== null) as NonNullable<typeof hiringMetrics[number]>[];
        if (validMetrics.length === 0) return null;
        
        const initial = { appToPhone: 0, phoneToFinal: 0, finalToOrientation: 0, orientationToHire: 0, totalTime: 0, appToPhoneCount: 0, phoneToFinalCount: 0, finalToOrientationCount: 0, orientationToHireCount: 0, totalTimeCount: 0 };
        
        const sums = validMetrics.reduce((acc, curr) => {
            if (curr.appToPhone !== null) { acc.appToPhone += curr.appToPhone; acc.appToPhoneCount++; }
            if (curr.phoneToFinal !== null) { acc.phoneToFinal += curr.phoneToFinal; acc.phoneToFinalCount++; }
            if (curr.finalToOrientation !== null) { acc.finalToOrientation += curr.finalToOrientation; acc.finalToOrientationCount++; }
            if (curr.orientationToHire !== null) { acc.orientationToHire += curr.orientationToHire; acc.orientationToHireCount++; }
            if (curr.totalTime !== null) { acc.totalTime += curr.totalTime; acc.totalTimeCount++; }
            return acc;
        }, initial);

        return {
            avgAppToPhone: sums.appToPhoneCount > 0 ? (sums.appToPhone / sums.appToPhoneCount).toFixed(1) : 'N/A',
            avgPhoneToFinal: sums.phoneToFinalCount > 0 ? (sums.phoneToFinal / sums.phoneToFinalCount).toFixed(1) : 'N/A',
            avgFinalToOrientation: sums.finalToOrientationCount > 0 ? (sums.finalToOrientation / sums.finalToOrientationCount).toFixed(1) : 'N/A',
            avgOrientationToHire: sums.orientationToHireCount > 0 ? (sums.orientationToHire / sums.orientationToHireCount).toFixed(1) : 'N/A',
            avgTotalTime: sums.totalTimeCount > 0 ? (sums.totalTime / sums.totalTimeCount).toFixed(1) : 'N/A',
        };
    }
    
    const averages = calculateAverages();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Zap /> Speed to Hire Metrics</CardTitle>
                <CardDescription>
                    Time taken in days for each stage of the hiring process for successfully hired candidates.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {averages && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                        <Card className="text-center"><CardHeader><CardTitle>{averages.avgAppToPhone}</CardTitle><CardDescription>Avg. App to Phone</CardDescription></CardHeader></Card>
                        <Card className="text-center"><CardHeader><CardTitle>{averages.avgPhoneToFinal}</CardTitle><CardDescription>Avg. Phone to Final</CardDescription></CardHeader></Card>
                        <Card className="text-center"><CardHeader><CardTitle>{averages.avgFinalToOrientation}</CardTitle><CardDescription>Avg. Final to Orientation</CardDescription></CardHeader></Card>
                        <Card className="text-center"><CardHeader><CardTitle>{averages.avgOrientationToHire}</CardTitle><CardDescription>Avg. Orientation to Hire</CardDescription></CardHeader></Card>
                        <Card className="text-center col-span-2 lg:col-span-1 bg-muted"><CardHeader><CardTitle>{averages.avgTotalTime}</CardTitle><CardDescription>Avg. Total Time to Hire</CardDescription></CardHeader></Card>
                    </div>
                )}
                {hiringMetrics.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Caregiver</TableHead>
                                <TableHead className="text-center">App → Phone</TableHead>
                                <TableHead className="text-center">Phone → Final</TableHead>
                                <TableHead className="text-center">Final → Orientation</TableHead>
                                <TableHead className="text-center">Orientation → Hire</TableHead>
                                <TableHead className="text-right">Total Time to Hire</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hiringMetrics.map((metric, index) => metric && (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{metric.name}</TableCell>
                                    <TableCell className="text-center">{metric.appToPhone ?? 'N/A'}</TableCell>
                                    <TableCell className="text-center">{metric.phoneToFinal ?? 'N/A'}</TableCell>
                                    <TableCell className="text-center">{metric.finalToOrientation ?? 'N/A'}</TableCell>
                                    <TableCell className="text-center">{metric.orientationToHire ?? 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge>{metric.totalTime ?? 'N/A'} days</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-center text-muted-foreground py-10">No hired candidates found to calculate metrics.</p>
                )}
            </CardContent>
        </Card>
    );
}
