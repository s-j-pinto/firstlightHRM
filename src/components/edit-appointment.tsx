
"use client";

import { useState, useTransition, useEffect } from "react";
import { format, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { updateAppointment } from "@/lib/appointments.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditAppointmentProps {
  appointmentId: string;
  currentDate: Date;
  currentEndDate: Date;
  isOpen: boolean;
  onClose: () => void;
}

export function EditAppointment({ 
    appointmentId, 
    currentDate, 
    currentEndDate,
    isOpen, 
    onClose 
}: EditAppointmentProps) {
  const [date, setDate] = useState<Date | undefined>(currentDate);
  const [time, setTime] = useState<string>(format(currentDate, "HH:mm"));
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setDate(currentDate);
    setTime(format(currentDate, "HH:mm"));
  }, [currentDate, isOpen]);

  const handleUpdate = () => {
    if (!date || !time) return;

    startTransition(async () => {
      const duration = currentEndDate.getTime() - currentDate.getTime();
      
      const [hours, minutes] = time.split(':').map(Number);
      let newStartDate = setHours(date, hours);
      newStartDate = setMinutes(newStartDate, minutes);

      const newEndDate = new Date(newStartDate.getTime() + duration);

      const result = await updateAppointment(appointmentId, newStartDate, newEndDate);
      if (result.error) {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: result.message,
        });
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleUpdate} disabled={isPending || !date || !time}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
