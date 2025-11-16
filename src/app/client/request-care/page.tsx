
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitCareRequest } from "@/lib/client-care-request.actions";
import { HelpDialog } from "@/components/HelpDialog";

const requestCareSchema = z.object({
  preferredDate: z.date({ required_error: "A preferred date is required." }),
  preferredTime: z.string().min(1, "A preferred time is required."),
  duration: z.string().min(1, "Please select a duration."),
  reason: z.string().min(10, "Please provide a brief reason for your request."),
  preferredCaregiver: z.string().optional(),
  urgency: z.string().min(1, "Please select an urgency level."),
});

type RequestCareFormValues = z.infer<typeof requestCareSchema>;

export default function RequestCarePage() {
  const [isPending, startTransition] = useTransition();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<RequestCareFormValues>({
    resolver: zodResolver(requestCareSchema),
    defaultValues: {
      preferredTime: "09:00",
      duration: "",
      reason: "",
      preferredCaregiver: "",
      urgency: "",
    },
  });

  const onSubmit = (data: RequestCareFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to make a request.", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await submitCareRequest(data);
      if (result.error) {
        toast({ title: "Request Failed", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Request Sent", description: result.message });
        router.push("/client/dashboard"); // Or a confirmation page
      }
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="flex flex-row justify-between items-start">
        <div>
            <CardTitle>Request Additional Care</CardTitle>
            <CardDescription>
              Fill out the form below to request additional care hours. Our staffing team will review your request and be in touch shortly.
            </CardDescription>
        </div>
        <HelpDialog topic="clientRequestCare" />
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="preferredDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Preferred Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration of Care</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2 hours">2 hours</SelectItem>
                      <SelectItem value="4 hours (half-day)">4 hours (half-day)</SelectItem>
                      <SelectItem value="8 hours (full-day)">8 hours (full-day)</SelectItem>
                      <SelectItem value="Overnight">Overnight</SelectItem>
                      <SelectItem value="Other">Other (please specify in reason)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Request</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Family event, recovering from illness, regular caregiver unavailable..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preferredCaregiver"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Caregiver (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter caregiver name if you have a preference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ASAP">ASAP</SelectItem>
                      <SelectItem value="Within 24 hours">Within 24 hours</SelectItem>
                      <SelectItem value="This week">This week</SelectItem>
                      <SelectItem value="Flexible">Flexible / Planning ahead</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Request
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
