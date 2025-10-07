
"use client";

import { useState, useTransition, useMemo } from "react";
import { format } from "date-fns";
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
} from "lucide-react";
import { collection, query, where } from "firebase/firestore";
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
import { sendCalendarInvite } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

type AppointmentWithCaregiver = Appointment & { caregiver?: CaregiverProfile };

const groupAppointmentsByDay = (appointments: AppointmentWithCaregiver[]) => {
  return appointments.reduce((acc, appointment) => {
    const dateStr = format(appointment.startTime, "yyyy-MM-dd");
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(appointment);
    return acc;
  }, {} as Record<string, AppointmentWithCaregiver[]>);
};

const BooleanDisplay = ({ value }: { value: boolean | undefined }) => 
  value ? <Check className="text-green-500"/> : <X className="text-red-500"/>;

const AvailabilityDisplay = ({ availability }: { availability: CaregiverProfile['availability'] | undefined }) => {
    if (!availability) return <p>Not specified</p>;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
        <div className="space-y-2">
            {days.map(day => {
                const shifts = availability[day as keyof typeof availability];
                if (shifts && shifts.length > 0) {
                    return (
                        <div key={day} className="grid grid-cols-[100px_1fr] items-start">
                            <span className="font-semibold capitalize">{day}:</span>
                            <div className="flex flex-wrap gap-1">
                                {shifts.map(shift => <Badge key={shift} variant="secondary" className="capitalize">{shift}</Badge>)}
                            </div>
                        </div>
                    )
                }
                return null;
            })}
        </div>
    )
}

export default function AdminDashboard() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();

  const appointmentsRef = useMemoFirebase(() => collection(firestore, 'appointments'), [firestore]);
  const { data: appointmentsData, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);

  const caregiverProfilesRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), [firestore]);
  const { data: caregiversData, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiverProfilesRef);
  
  const appointments: AppointmentWithCaregiver[] = useMemo(() => {
    if (!appointmentsData || !caregiversData) return [];
    
    const caregiversMap = new Map(caregiversData.map(c => [c.id, c]));

    return appointmentsData.map(appt => ({
      ...appt,
      startTime: (appt.startTime as any).toDate(), // Convert Firestore Timestamp to Date
      endTime: (appt.endTime as any).toDate(),
      caregiver: caregiversMap.get(appt.caregiverId),
    }));
  }, [appointmentsData, caregiversData]);


  const handleSendInvite = (appointment: Appointment) => {
    console.log("CLIENT: 'Send Invite' button clicked. Preparing to call server action with appointment data:", appointment);
    startTransition(async () => {
      const result = await sendCalendarInvite(appointment);
      console.log("CLIENT: Received response from server action:", result);
      toast({
        title: result.error ? "Error" : "Success",
        description: result.message,
        variant: result.error ? "destructive" : "default",
      });
    });
  };

  const groupedAppointments = groupAppointmentsByDay(
    appointments.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  );
  
  const isLoading = appointmentsLoading || caregiversLoading;

  if (isLoading) {
    return (
       <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading appointments...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.keys(groupedAppointments).length === 0 && !isLoading && (
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
                          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                            <h3 className="font-semibold text-lg flex items-center"><Briefcase className="mr-2 h-5 w-5 text-accent" />Experience</h3>
                            <p><span className="font-semibold">Years:</span> {appointment.caregiver.yearsExperience}</p>
                            <p><span className="font-semibold">Summary:</span> {appointment.caregiver.summary}</p>
                            
                            <Separator className="my-2"/>
                            
                             <h3 className="font-semibold text-lg flex items-center mb-2"><Stethoscope className="mr-2 h-5 w-5 text-accent" />Skills & Experience</h3>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <p className="flex items-center"><span className="font-semibold w-48">Able to change brief:</span> <BooleanDisplay value={appointment.caregiver.canChangeBrief} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to Transfer:</span> <BooleanDisplay value={appointment.caregiver.canTransfer} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to prepare meals:</span> <BooleanDisplay value={appointment.caregiver.canPrepareMeals} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Bed bath/shower assistance:</span> <BooleanDisplay value={appointment.caregiver.canDoBedBath} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to use Hoyer Lift:</span> <BooleanDisplay value={appointment.caregiver.canUseHoyerLift} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to use Gait Belt:</span> <BooleanDisplay value={appointment.caregiver.canUseGaitBelt} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to use a Purwick:</span> <BooleanDisplay value={appointment.caregiver.canUsePurwick} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to empty catheter:</span> <BooleanDisplay value={appointment.caregiver.canEmptyCatheter} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to empty colostomy bag:</span> <BooleanDisplay value={appointment.caregiver.canEmptyColostomyBag} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to give medication:</span> <BooleanDisplay value={appointment.caregiver.canGiveMedication} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Able to take blood Pressure:</span> <BooleanDisplay value={appointment.caregiver.canTakeBloodPressure} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Dementia patients experience:</span> <BooleanDisplay value={appointment.caregiver.hasDementiaExperience} /></p>
                                <p className="flex items-center"><span className="font-semibold w-48">Hospice patients experience:</span> <BooleanDisplay value={appointment.caregiver.hasHospiceExperience} /></p>
                            </div>

                            <Separator className="my-2"/>
                            
                            <h3 className="font-semibold text-lg flex items-center"><FileText className="mr-2 h-5 w-5 text-accent" />Certifications</h3>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">HCA:</span> <BooleanDisplay value={appointment.caregiver.hca} /></p>
                                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">HHA:</span> <BooleanDisplay value={appointment.caregiver.hha} /></p>
                                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">CNA:</span> <BooleanDisplay value={appointment.caregiver.cna} /></p>
                                <p className="flex items-center gap-2"><ScanSearch className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">Live Scan:</span> <BooleanDisplay value={appointment.caregiver.liveScan} /></p>
                                <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">TB Test:</span> <BooleanDisplay value={appointment.caregiver.negativeTbTest} /></p>
                                <p className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">CPR/First Aid:</span> <BooleanDisplay value={appointment.caregiver.cprFirstAid} /></p>
                                <p className="flex items-center gap-2"><Biohazard className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">COVID Work:</span> <BooleanDisplay value={appointment.caregiver.canWorkWithCovid} /></p>
                                <p className="flex items-center gap-2"><Biohazard className="h-4 w-4 text-muted-foreground"/> <span className="font-semibold w-24">COVID Vaccine:</span> <BooleanDisplay value={appointment.caregiver.covidVaccine} /></p>
                            </div>
                            {appointment.caregiver.otherLanguages && <p className="flex items-center gap-2"><Languages className="h-4 w-4 mt-1 text-muted-foreground" /><span className="font-semibold">Other Languages:</span> {appointment.caregiver.otherLanguages}</p>}
                            {appointment.caregiver.otherCertifications && <p><span className="font-semibold">Other:</span> {appointment.caregiver.otherCertifications}</p>}
                            
                            <Separator className="my-2"/>
                            
                            <h3 className="font-semibold text-lg flex items-center"><Calendar className="mr-2 h-5 w-5 text-accent" />Availability</h3>
                            <AvailabilityDisplay availability={appointment.caregiver.availability} />

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

    