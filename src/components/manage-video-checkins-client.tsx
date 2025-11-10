
"use client";
import { useState, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Calendar as CalendarIcon,
  User,
  MessageSquare,
  Video,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { VideoCheckinRequest, ActiveCaregiver } from "@/lib/types";
import { scheduleVideoCheckin } from "@/lib/video-checkin.actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";

const scheduleSchema = z.object({
  caregiverEmail: z.string().email("A caregiver must be selected."),
  scheduledDate: z.date({ required_error: "A date is required." }),
  scheduledTime: z.string().min(1, "A time is required."),
});
type ScheduleFormData = z.infer<typeof scheduleSchema>;

export default function ManageVideoCheckinsClient() {
  const [selectedRequest, setSelectedRequest] =
    useState<VideoCheckinRequest | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const requestsRef = useMemoFirebase(
    () => collection(firestore, "video_checkin_requests"),
    []
  );
  const { data: requestsData, isLoading: requestsLoading } =
    useCollection<VideoCheckinRequest>(requestsRef);
    
  const caregiversRef = useMemoFirebase(
    () => collection(firestore, 'caregivers_active'),
    []
  );
  const { data: caregiversData, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(caregiversRef);

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
  });

  const sortedRequests = useMemo(() => {
    if (!requestsData) return [];
    return requestsData.sort((a, b) => {
      const statusOrder = { pending: 0, scheduled: 1, completed: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return (b.createdAt as any).toDate() - (a.createdAt as any).toDate();
    });
  }, [requestsData]);
  
  const activeCaregivers = useMemo(() => {
    return caregiversData?.filter(cg => cg.status === 'ACTIVE').sort((a,b) => a.Name.localeCompare(b.Name)) || [];
  }, [caregiversData]);

  const handleSelectRequest = (request: VideoCheckinRequest) => {
    setSelectedRequest(request);
    form.reset({
      caregiverEmail: request.caregiverEmail || "",
      scheduledDate: request.scheduledAt
        ? (request.scheduledAt as any).toDate()
        : new Date(),
      scheduledTime: request.scheduledAt
        ? format((request.scheduledAt as any).toDate(), "HH:mm")
        : "",
    });
  };

  const onSubmit = (data: ScheduleFormData) => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const result = await scheduleVideoCheckin({
        requestId: selectedRequest.id,
        caregiverEmail: data.caregiverEmail,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
      });

      if (result.error) {
        toast({
          title: "Scheduling Failed",
          description: result.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Scheduled Successfully", description: result.message });
        setSelectedRequest(null);
      }
    });
  };

  const StatusBadge = ({ status }: { status: VideoCheckinRequest["status"] }) => {
    const colorClass =
      status === "pending"
        ? "bg-yellow-500"
        : status === "scheduled"
        ? "bg-blue-500"
        : status === "completed"
        ? "bg-green-500"
        : "bg-gray-500";
    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
  };
  
  const isLoading = requestsLoading || caregiversLoading;

  return (
    <div>
        <div className="mt-6">
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading requests...</p>
            </div>
        ) : sortedRequests.length === 0 ? (
            <Card className="text-center py-16">
            <CardHeader>
                <CardTitle>No Requests Found</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                There are currently no video check-in requests.
                </p>
            </CardContent>
            </Card>
        ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedRequests.map((request) => (
                <Card
                key={request.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleSelectRequest(request)}
                >
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                    {request.clientName}
                    <StatusBadge status={request.status} />
                    </CardTitle>
                    <CardDescription>
                    Requested on {format((request.createdAt as any).toDate(), "PP")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />{" "}
                    <strong>For:</strong> {request.requestedBy}
                    </p>
                    {request.status === 'scheduled' && request.scheduledAt && (
                         <p className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />{" "}
                            <strong>Scheduled:</strong> {format((request.scheduledAt as any).toDate(), 'PP p')}
                        </p>
                    )}
                </CardContent>
                </Card>
            ))}
            </div>
        )}
        </div>

      <Dialog
        open={!!selectedRequest}
        onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>Video Request from {selectedRequest.clientName}</DialogTitle>
                <DialogDescription>
                  Review the details and schedule a Google Meet call.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto p-1">
                <Card className="my-4">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare /> Request Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>Check-in For:</strong> {selectedRequest.requestedBy}
                    </p>
                    <div>
                      <strong>Notes from Client:</strong>
                      <p className="p-3 bg-muted rounded-md mt-1 whitespace-pre-wrap">
                        {selectedRequest.notes || "No notes provided."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {selectedRequest.status === 'scheduled' ? (
                     <Card className="my-4 border-blue-500">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Video /> Scheduled Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                             <p><strong>Caregiver:</strong> {selectedRequest.caregiverEmail}</p>
                             <p><strong>Time:</strong> {format((selectedRequest.scheduledAt as any).toDate(), 'PPPPp')}</p>
                             <p><strong>Meet Link:</strong> <a href={selectedRequest.googleMeetLink} target="_blank" rel="noopener noreferrer" className="text-accent underline">{selectedRequest.googleMeetLink}</a></p>
                        </CardContent>
                    </Card>
                ) : (
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                        control={form.control}
                        name="caregiverEmail"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Assign Caregiver</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a caregiver" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {activeCaregivers.map(cg => (
                                    <SelectItem key={cg.id} value={cg.Email}>{cg.Name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="scheduledDate"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                            "pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                            format(field.value, "PPP")
                                            ) : (
                                            <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                        />
                                    </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="scheduledTime"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Time</FormLabel>
                                    <FormControl>
                                    <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                            Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isPending}>
                            {isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Schedule & Send Invite
                        </Button>
                        </DialogFooter>
                    </form>
                    </Form>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
