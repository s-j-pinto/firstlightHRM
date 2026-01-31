"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { Loader2, TrendingDown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';


export default function RejectionPointAnalysisReport() {
  const profilesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_profiles')), []);
  const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesQuery);

  const interviewsQuery = useMemoFirebase(() => query(collection(firestore, 'interviews')), []);
  const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsQuery);
  
  const employeesQuery = useMemoFirebase(() => query(collection(firestore, 'caregiver_employees')), []);
  const { data: employees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesQuery);

  const funnelData = useMemo(() => {
    if (!profiles || !interviews || !employees) return [];

    const totalApplications = profiles.length;
    const phoneScreened = interviews.length;
    const passedPhoneScreen = interviews.filter(i => i.phoneScreenPassed === 'Yes').length;
    const passedFinalInterview = interviews.filter(i => i.finalInterviewStatus === 'Passed').length;
    const hired = employees.length;

    return [
      { name: 'Total Applications', value: totalApplications, fill: '#8884d8' },
      { name: 'Phone Screened', value: phoneScreened, fill: '#83a6ed' },
      { name: 'Passed Phone Screen', value: passedPhoneScreen, fill: '#8dd1e1' },
      { name: 'Passed Final Interview', value: passedFinalInterview, fill: '#82ca9d' },
      { name: 'Hired', value: hired, fill: '#a4de6c' },
    ];
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
        <CardTitle className="flex items-center gap-2"><TrendingDown /> Hiring Funnel & Rejection Points</CardTitle>
        <CardDescription>
          Visualizing where candidates drop off during the hiring process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {funnelData.length > 0 && funnelData[0].value > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                 <LabelList position="center" fill="#fff" stroke="none" dataKey="value" formatter={(value: number) => `${value}`} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground">No data available to display the funnel.</p>
        )}
      </CardContent>
    </Card>
  );
}
