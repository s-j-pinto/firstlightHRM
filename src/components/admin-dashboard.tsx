"use client";

import { useState, useTransition } from "react";
import { format, isSameDay } from "date-fns";
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
} from "lucide-react";

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
import { sendCalendarInvite } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

interface AdminDashboardProps {
  initialAppointments: (Appointment & { caregiver?: CaregiverProfile })[];
}

const groupAppointmentsByDay = (appointments: (Appointment & { caregiver?: CaregiverProfile })[]) => {
  return appointments.reduce((acc, appointment) => {
    const dateStr = format(appointment.startTime, "yyyy-MM-dd");
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(appointment);
    return acc;
  }, {} as Record<string, (Appointment & { caregiver?: CaregiverProfile })[]>);
};

export default function AdminDashboard({ initialAppointments }: AdminDashboardProps) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSendInvite = (appointment: Appointment) => {
    startTransition(async () => {
      const result = await sendCalendarInvite(appointment);
      toast({
        title: "Success",
        description: result.message,
      });
    });
  };

  const groupedAppointments = groupAppointmentsByDay(
    appointments.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  );

  return (
    <div className="space-y-8">
      {Object.keys(groupedAppointments).length === 0 && (
        <div className="text-center py-16 border-dashed border-2 rounded-lg">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming appointments</h3>
            <p className="mt-1 text-sm text-muted-foreground">New appointments will appear here once scheduled.</p>
        </div>
      )}
      {Object.entries(groupedAppointments).map(([date, dayAppointments]) => (
        <div key={date}>
          <h2 className="text-xl font-semibold mb-4 pb-2 border-b">
            {format(new Date(date), "EEEE, MMMM do, yyyy")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dayAppointments.map((appointment) => (
              <Card key={appointment.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <User className="mr-2 h-5 w-5 text-accent" />
                      {appointment.caregiver?.fullName}
                    </span>
                    <Badge variant="outline">{format(appointment.startTime, "h:mm a")}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-4 w-4" />
                    <span>{appointment.caregiver?.email}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4" />
                    <span>{appointment.caregiver?.phone}</span>
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">View Profile</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[625px]">
                        <DialogHeader>
                          <DialogTitle className="text-2xl">{appointment.caregiver?.fullName}</DialogTitle>
                        </DialogHeader>
                        {appointment.caregiver && (
                          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                            <h3 className="font-semibold text-lg flex items-center"><Briefcase className="mr-2 h-5 w-5 text-accent" />Experience</h3>
                            <p><span className="font-semibold">Years:</span> {appointment.caregiver.yearsExperience}</p>
                            <p><span className="font-semibold">Summary:</span> {appointment.caregiver.summary}</p>
                            
                            <Separator className="my-2"/>
                            
                            <h3 className="font-semibold text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-accent" />Certifications</h3>
                            <p><span className="font-semibold">CPR Certified:</span> {appointment.caregiver.cprCertified ? 'Yes' : 'No'}</p>
                            {appointment.caregiver.cnaLicense && <p><span className="font-semibold">CNA License:</span> {appointment.caregiver.cnaLicense}</p>}
                            {appointment.caregiver.otherCertifications && <p><span className="font-semibold">Other:</span> {appointment.caregiver.otherCertifications}</p>}
                            
                            <Separator className="my-2"/>
                            
                            <h3 className="font-semibold text-lg flex items-center"><Calendar className="mr-2 h-5 w-5 text-accent" />Availability</h3>
                            <p><span className="font-semibold">Days:</span> {appointment.caregiver.availableDays.join(', ')}</p>
                            <p><span className="font-semibold">Shift:</span> {appointment.caregiver.preferredShift}</p>

                            <Separator className="my-2"/>
                            
                            <h3 className="font-semibold text-lg flex items-center"><Car className="mr-2 h-5 w-5 text-accent" />Transportation</h3>
                             <p><span className="font-semibold">Has Vehicle:</span> {appointment.caregiver.hasCar}</p>
                             <p><span className="font-semibold">Valid License:</span> {appointment.caregiver.validLicense}</p>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button onClick={() => handleSendInvite(appointment)} disabled={isPending} className="w-full bg-accent hover:bg-accent/90">
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send Invite
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
