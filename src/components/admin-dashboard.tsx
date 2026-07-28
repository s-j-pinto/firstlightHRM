"use client";

import { useState, useTransition, useMemo } from "react";
import { format, subWeeks, isValid } from "date-fns";
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Send,
  Loader2,
  Briefcase,
  FileText,
  Car,
  Check,
  X,
  Stethoscope,
  Languages,
  ShieldCheck,
  Biohazard,
  ScanSearch,
  AlertCircle,
  ExternalLink,
  Calendar as CalendarIcon,
  Clock4,
  Edit2
} from "lucide-react";
import Link from 'next/link';
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";

import type { Appointment, CaregiverProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { sendCalendarInvite } from "@/lib/google-calendar.actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EditAppointment } from "@/components/edit-appointment";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type AppointmentWithCaregiver = Appointment & { caregiver?: CaregiverProfile };

const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    const d = new Date(value);
    return isValid(d) ? d : null;
};

const groupAppointmentsByDay = (appointments: AppointmentWithCaregiver[]) => {
  if (!appointments) return {};
  return appointments.reduce((acc, appointment) => {
    const dateStr = format(appointment.startTime, "yyyy-MM-dd");
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(appointment);
    return acc;
  }, {} as Record<string, AppointmentWithCaregiver[]>);
};

export default function AdminDashboard() {
  const [isPending, startTransition] = useTransition();
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();

  const fourWeeksAgo = useMemo(() => subWeeks(new Date(), 4), []);

  // Optimized query: only fetch recent, active appointments
  // We project fields in the dashboard to save bytes
  const appointmentsRef = useMemoFirebase(() => 
    firestore ? query(
        collection(firestore, 'appointments'), 
        where('startTime', '>=', fourWeeksAgo),
        orderBy('startTime', 'desc'),
        limit(100)
    ) : null, 
    [firestore, fourWeeksAgo]
  );
  const { data: appointmentsData, isLoading: appointmentsLoading, error: appointmentsError } = useCollection<Appointment>(appointmentsRef);

  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCaregiver | null>(null);

  const appointments: AppointmentWithCaregiver[] = useMemo(() => {
    if (!appointmentsData) return [];

    return appointmentsData
      .filter(appt => appt.appointmentStatus !== "cancelled")
      .map(appt => {
        const startTime = safeToDate(appt.startTime);
        const endTime = safeToDate(appt.endTime);
        
        if (!startTime || !endTime) return null;

        return {
          ...appt,
          startTime,
          endTime,
          preferredTimes: appt.preferredTimes?.map(t => safeToDate(t)).filter((t): t is Date => t !== null),
        };
      })
      .filter((appt): appt is AppointmentWithCaregiver => appt !== null);
  }, [appointmentsData]);


  const handleSendInvite = (appointment: AppointmentWithCaregiver) => {
    startTransition(async () => {
      setPendingInviteId(appointment.id);
      const result = await sendCalendarInvite(appointment);

      if (result.authUrl) {
        setAuthUrl(result.authUrl);
      } else {
        setAuthUrl(null); 
      }
      
      toast({
        title: result.error ? "Error" : "Success",
        description: result.message,
        variant: result.error ? "destructive" : "default",
      });
      setPendingInviteId(null);
    });
  };

  const groupedAppointments = groupAppointmentsByDay(appointments);
  
  if (appointmentsLoading) {
    return (
       <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Consulting database...</p>
        </div>
    );
  }

  if (appointmentsError) {
      return (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Dashboard Error</AlertTitle>
              <AlertDescription>
                  {appointmentsError.message}
              </AlertDescription>
          </Alert>
      )
  }

  return (
    <div className="space-y-8">
       {authUrl && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required: Authorize Google Calendar</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              To send calendar invites, you must grant permission. Click the button below to authorize.
            </p>
            <Button asChild>
                <a href={authUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Authorization Page
                </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {Object.keys(groupedAppointments).length === 0 && (
        <div className="text-center py-16 border-dashed border-2 rounded-lg">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming appointments</h3>
            <p className="mt-1 text-sm text-muted-foreground">New appointments from the last 4 weeks will appear here.</p>
        </div>
      )}
      {Object.keys(groupedAppointments).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => {
        const dayAppointments = groupedAppointments[date];
        return (
          <div key={date}>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
              {format(dayAppointments[0].startTime, "EEEE, MMMM do, yyyy")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dayAppointments.map((appointment) => {
                const isSending = isPending && pendingInviteId === appointment.id;
                return (
                <Card key={appointment.id} className={cn("shadow-md hover:shadow-lg transition-shadow", appointment.inviteSent && "opacity-75")}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <User className="mr-2 h-5 w-5 text-accent" />
                        {appointment.caregiverName}
                      </span>
                      <Badge variant="outline">{format(appointment.startTime, "h:mm a")}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-2 h-4 w-4" />
                      <span>{appointment.caregiverEmail}</span>
                    </div>
                    
                    {appointment.preferredTimes && appointment.preferredTimes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold flex items-center mb-2">
                          <Clock4 className="mr-2 h-4 w-4" />
                          Candidate&apos;s Preferred Times:
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {appointment.preferredTimes.map((time, index) => (
                            <Badge key={index} variant={appointment.startTime.getTime() === time.getTime() ? 'default' : 'secondary'}>
                              {format(time, 'p')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <Button 
                            onClick={() => router.push(`/admin/manage-interviews?candidateId=${appointment.caregiverId}`)}
                            variant="outline" 
                            className="w-full"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            Manage
                        </Button>

                        <Button 
                            onClick={() => setEditingAppointment(appointment)}
                            variant="secondary" 
                            className="w-full"
                        >
                            <Edit2 className="mr-2 h-4 w-4" />
                            Time
                        </Button>

                        <Button 
                            onClick={() => handleSendInvite(appointment)} 
                            disabled={isSending || appointment.inviteSent}
                            className="w-full bg-accent hover:bg-accent/90 disabled:bg-gray-300 col-span-2"
                        >
                            {isSending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="mr-2 h-4 w-4" />
                            )}
                            {appointment.inviteSent ? 'Invite Sent' : 'Send Invite'}
                        </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>
        )
      })}

      {editingAppointment && (
        <EditAppointment
          appointmentId={editingAppointment.id}
          currentDate={editingAppointment.startTime}
          currentEndDate={editingAppointment.endTime}
          isOpen={!!editingAppointment}
          onClose={() => setEditingAppointment(null)}
        />
      )}
    </div>
  );
}
