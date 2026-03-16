

"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
import type { CaregiverProfile, Interview, CaregiverEmployee, Appointment } from '@/lib/types';


export default function RejectionPointAnalysisReport() {
  const firestore = useFirestore();
  const profilesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'caregiver_profiles')) : null, [firestore]);
  const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesQuery);

  const interviewsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'interviews')) : null, [firestore]);
  const { data: interviews, isLoading: interviewsLoading } = useCollection<Interview>(interviewsQuery);
  
  const employeesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'caregiver_employees')) : null, [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesQuery);

  const appointmentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'appointments')) : null, [firestore]);
  const { data: appointments, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsQuery);

  const funnelData = useMemo(() => {
    if (!profiles || !interviews || !employees || !appointments) return [];
    
    const appointmentsMap = new Map();
    appointments.forEach(appt => {
        if(appt.appointmentStatus !== 'cancelled') {
            appointmentsMap.set(appt.caregiverId, appt);
        }
    });

    const totalApplications = profiles.length;
    const appointmentScheduled = profiles.filter(p => appointmentsMap.has(p.id)).length;
    const phoneScreened = interviews.length;
    const passedPhoneScreen = interviews.filter(i => i.phoneScreenPassed === 'Yes').length;
    const passedFinalInterview = interviews.filter(i => i.finalInterviewStatus === 'Passed').length;
    const hired = employees.length;

    return [
      { name: 'Total Applications', value: totalApplications, fill: '#8884d8' },
      { name: 'Appointment Scheduled', value: appointmentScheduled, fill: '#83a6ed' },
      { name: 'Phone Screened', value: phoneScreened, fill: '#8dd1e1' },
      { name: 'Passed Phone Screen', value: passedPhoneScreen, fill: '#82ca9d' },
      { name: 'Passed Final Interview', value: passedFinalInterview, fill: '#a4de6c' },
      { name: 'Hired', value: hired, fill: '#d0ed57' },
    ];
  }, [profiles, interviews, employees, appointments]);

  const isLoading = profilesLoading || interviewsLoading || employeesLoading || appointmentsLoading;

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
