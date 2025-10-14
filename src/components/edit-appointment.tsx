
"use client";

import { useState, useTransition, useEffect } from "react";
import { format, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { useToast } from "@/hooks/use-toast";
import { updateAppointment, cancelAppointment } from "@/lib/appointments.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditAppointmentProps {
  appointmentId: string;
  currentDate: Date;
  currentEndDate: Date;
  isOpen: boolean;
  onClose: () => void;
}

const cancellationReasons = [
    { id: "withdraw", label: "CG called to withdraw application" },
    { id: "overbooked", label: "Overbooked" },
    { id: "pay_too_low", label: "Pay too low" },
];

export function EditAppointment({ 
    appointmentId, 
    currentDate, 
    currentEndDate,
    isOpen, 
    onClose 
}: EditAppointmentProps) {
  const [date, setDate] = useState<Date | undefined>(currentDate);
  const [time, setTime] = useState<string>(format(currentDate, "HH:mm"));
  const [isUpdatePending, startUpdateTransition] = useTransition();
  const [isCancelPending, startCancelTransition] = useTransition();
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setDate(currentDate);
    setTime(format(currentDate, "HH:mm"));
  }, [currentDate, isOpen]);

  const handleUpdate = () => {
    if (!date || !time) return;

    startUpdateTransition(async () => {
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

  const handleCancelAppointment = () => {
      if (!cancelReason) {
          toast({ title: "Error", description: "Please select a reason for cancellation.", variant: "destructive" });
          return;
      }
      startCancelTransition(async () => {
        const result = await cancelAppointment(appointmentId, cancelReason);
        if (result.error) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
            setIsCancelAlertOpen(false);
            onClose();
        }
      });
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
          <DialogFooter className="sm:justify-between">
            <Button variant="destructive" onClick={() => setIsCancelAlertOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel Appointment
            </Button>
            <div className="flex gap-2">
                <DialogClose asChild>
                    <Button variant="outline">Back</Button>
                </DialogClose>
                <Button onClick={handleUpdate} disabled={isUpdatePending || !date || !time}>
                    {isUpdatePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Appointment
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will cancel the appointment. Please select a reason below. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Label>Reason for Cancellation</Label>
                 <RadioGroup onValueChange={setCancelReason} className="mt-2 space-y-2">
                    {cancellationReasons.map(reason => (
                         <div key={reason.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={reason.label} id={reason.id} />
                            <Label htmlFor={reason.id} className="font-normal">{reason.label}</Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelAppointment} disabled={isCancelPending || !cancelReason} className="bg-destructive hover:bg-destructive/90">
                     {isCancelPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Cancellation
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
