
"use client";

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Appointment, CaregiverProfile } from '@/lib/types';
import { format } from 'date-fns';
import { Loader2, User, Calendar, AlertTriangle } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CancelledAppointment = Appointment & {
  caregiver?: CaregiverProfile;
};

export default function CancelledInterviewsReport() {
  const appointmentsRef = useMemoFirebase(() => 
    query(collection(firestore, 'appointments'), where('appointmentStatus', '==', 'cancelled')),
    [firestore]
  );
  const { data: appointments, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);

  const profilesRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), []);
  const { data: profiles, isLoading: profilesLoading } = useCollection<CaregiverProfile>(profilesRef);

  const cancelledAppointments = useMemo((): CancelledAppointment[] => {
    if (!appointments || !profiles) {
      return [];
    }

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    return appointments
      .map(appt => ({
        ...appt,
        caregiver: profilesMap.get(appt.caregiverId),
      }))
      .sort((a, b) => {
        const dateA = (a.cancelDateTime as any)?.toDate() || 0;
        const dateB = (b.cancelDateTime as any)?.toDate() || 0;
        return dateB - dateA; // Sort by most recent cancellation
      });

  }, [appointments, profiles]);
  
  const isLoading = appointmentsLoading || profilesLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancelled Appointments Report</CardTitle>
        <CardDescription>
          A log of all phone screen appointments that have been cancelled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading cancelled appointments...</p>
          </div>
        ) : cancelledAppointments.length === 0 ? (
          <div className="text-center py-16 border-dashed border-2 rounded-lg">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Cancelled Appointments</h3>
            <p className="mt-1 text-sm text-muted-foreground">There are currently no records of cancelled appointments.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caregiver</TableHead>
                <TableHead>Original Appointment</TableHead>
                <TableHead>Cancelled On</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cancelledAppointments.map(appt => {
                const originalTime = (appt.startTime as any)?.toDate();
                const cancelTime = (appt.cancelDateTime as any)?.toDate();

                return (
                  <TableRow key={appt.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{appt.caregiver?.fullName || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{appt.caregiver?.email || 'No email'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {originalTime ? format(originalTime, 'PPpp') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {cancelTime ? format(cancelTime, 'PPpp') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        {appt.cancelReason || 'No reason provided'}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
