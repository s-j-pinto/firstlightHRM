
"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { collection } from "firebase/firestore";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { scheduleAppointment } from "@/lib/actions";
import { generateAvailableSlots } from "@/lib/availability";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Appointment } from "@/lib/types";

interface AppointmentSchedulerProps {
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  caregiverPhone: string;
}

export function AppointmentScheduler({ caregiverId, caregiverName, caregiverEmail, caregiverPhone }: AppointmentSchedulerProps) {
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();

  const appointmentsRef = useMemoFirebase(() => collection(firestore, 'appointments'), [firestore]);
  const { data: appointmentsData, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);

  const availableSlots = useMemo(() => {
    if (!appointmentsData) return [];
    const bookedAppointments = appointmentsData.map(appt => ({
        ...appt,
        startTime: (appt.startTime as any).toDate(),
        endTime: (appt.endTime as any).toDate(),
    }));
    return generateAvailableSlots(bookedAppointments, 3);
  }, [appointmentsData]);
  
  const handleSelectSlot = (slot: Date) => {
    setSelectedSlot(slot);
  };

  const handleSubmit = () => {
    if (!selectedSlot || !caregiverId) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select a time slot.",
        });
        return;
    }
    
    startTransition(() => {
        scheduleAppointment({
            caregiverId: caregiverId,
            caregiverName: caregiverName,
            caregiverEmail: caregiverEmail, 
            caregiverPhone: caregiverPhone,
            startTime: selectedSlot,
            endTime: new Date(selectedSlot.getTime() + 30 * 60 * 1000), // 30 min slot
        });
    });
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto my-8 animate-in fade-in-50 duration-500 shadow-lg">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center font-headline">Schedule Your Interview</CardTitle>
        <CardDescription className="text-center">
          Congratulations, {caregiverName}! Please select a time slot for your interview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {appointmentsLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading available times...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {availableSlots.length > 0 ? (
              availableSlots.map(({ date, slots }) => (
                <div key={date.toISOString()}>
                  <h3 className="flex items-center text-lg font-semibold mb-3">
                    <Calendar className="h-5 w-5 mr-2 text-accent" />
                    {format(date, "EEEE, MMMM do")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {slots.map((slot) => (
                      <Button
                        key={slot.toISOString()}
                        variant={selectedSlot?.getTime() === slot.getTime() ? "default" : "outline"}
                        onClick={() => handleSelectSlot(slot)}
                        className={selectedSlot?.getTime() === slot.getTime() ? "bg-primary hover:bg-primary/90" : ""}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        {format(slot, "h:mm a")}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
                <div className="text-center py-10">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No times available</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Please check back later for more interview slots.</p>
                </div>
            )}
            {availableSlots.length > 0 && (
                <div className="pt-6 flex flex-col items-center">
                    <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={!selectedSlot || isPending}
                        className="bg-accent hover:bg-accent/90 w-full max-w-xs"
                    >
                        {isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Confirm Appointment
                    </Button>
                    {!selectedSlot && <p className="text-sm text-muted-foreground mt-2">Please select a time slot to continue.</p>}
                </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
