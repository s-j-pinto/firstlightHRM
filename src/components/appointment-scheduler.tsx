
"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { format, parse } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAvailableSlotsAction } from "@/lib/availability.actions";
import { useToast } from "@/hooks/use-toast";
import { firestore, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { Appointment } from "@/lib/types";
import { createAppointmentAndSendAdminEmail } from "@/lib/appointments.actions";
import { collection } from "firebase/firestore";
import { cn } from "@/lib/utils";


interface AppointmentSchedulerProps {
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  caregiverPhone: string;
}

const pacificTimeZone = "America/Los_Angeles";

export function AppointmentScheduler({ caregiverId, caregiverName, caregiverEmail, caregiverPhone }: AppointmentSchedulerProps) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  
  const [configuredSlots, setConfiguredSlots] = useState<{ date: string, slots: string[] }[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);

  const appointmentsRef = useMemoFirebase(() => db ? collection(db, 'appointments') : null, [db]);
  const { data: appointmentsData, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);

  useEffect(() => {
    getAvailableSlotsAction().then(slots => {
      setConfiguredSlots(slots);
      setIsLoadingSlots(false);
    });
  }, []);

  const availableSlots = useMemo(() => {
    if (!configuredSlots || !appointmentsData) return [];

    const bookedTimes = new Set(
      appointmentsData
        .filter(appt => appt.appointmentStatus !== 'cancelled')
        .map(appt => {
          const date = (appt.startTime as any).toDate();
          return formatInTimeZone(date, pacificTimeZone, "yyyy-MM-dd HH:mm");
        })
    );
    
    return configuredSlots.map(day => {
        const filteredSlots = day.slots.filter(slotStr => !bookedTimes.has(slotStr));
        return { ...day, slots: filteredSlots };
    }).filter(day => day.slots.length > 0);

  }, [configuredSlots, appointmentsData]);
  
  const handleSelectSlot = (slot: string) => {
    setSelectedSlots(prev => {
      if (prev.includes(slot)) {
        return prev.filter(s => s !== slot);
      }
      if (prev.length < 3) {
        return [...prev, slot];
      }
      return prev;
    });
  };

  const handleSubmit = () => {
    if (selectedSlots.length !== 3 || !caregiverId) {
        toast({
            variant: "destructive",
            title: "Selection Required",
            description: "Please select exactly 3 time slots.",
        });
        return;
    }
    
    startTransition(async () => {
        const appointmentDates = selectedSlots.map(slot => fromZonedTime(slot, pacificTimeZone)).sort((a,b) => a.getTime() - b.getTime());
        const result = await createAppointmentAndSendAdminEmail({ caregiverId, preferredTimes: appointmentDates });

        if (result.error) {
            toast({
                variant: "destructive",
                title: "Scheduling Failed",
                description: result.message,
            });
        } else {
             const redirectUrl = `/confirmation?time=${appointmentDates[0].toISOString()}`;
             router.push(redirectUrl);
        }
    });
  };
  
  const isLoading = isLoadingSlots || appointmentsLoading;

  return (
    <Card className="w-full max-w-4xl mx-auto my-8 animate-in fade-in-50 duration-500 shadow-lg">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center font-headline">Schedule Your Interview</CardTitle>
        <CardDescription className="text-center">
          Congratulations, {caregiverName}! Please select 3 preferred time slots for your interview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading available times...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {availableSlots.length > 0 ? (
              availableSlots.map(({ date, slots }) => (
                <div key={date}>
                  <h3 className="flex items-center text-lg font-semibold mb-3">
                    <Calendar className="h-5 w-5 mr-2 text-accent" />
                    {format(parse(date, "yyyy-MM-dd", new Date()), "EEEE, MMMM do")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {slots.map((slot) => {
                      const isSelected = selectedSlots.includes(slot);
                      return (
                        <Button
                          key={slot}
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleSelectSlot(slot)}
                          className={cn(isSelected ? "bg-primary hover:bg-primary/90" : "", selectedSlots.length >= 3 && !isSelected && "bg-muted/50 text-muted-foreground cursor-not-allowed")}
                          disabled={selectedSlots.length >= 3 && !isSelected}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          {format(parse(slot, "yyyy-MM-dd HH:mm", new Date()), "h:mm a")}
                        </Button>
                      )
                    })}
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
                    <p className="text-sm font-medium mb-2">
                        {selectedSlots.length} of 3 slots selected
                    </p>
                    <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={selectedSlots.length !== 3 || isPending}
                        className="bg-accent hover:bg-accent/90 w-full max-w-xs"
                    >
                        {isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Confirm Appointment
                    </Button>
                    {selectedSlots.length !== 3 && <p className="text-sm text-muted-foreground mt-2">Please select exactly 3 time slots to continue.</p>}
                </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
