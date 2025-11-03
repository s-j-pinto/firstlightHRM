
"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitInitialContact } from "@/lib/initial-contact.actions";
import { useDoc, useMemoFirebase, firestore } from "@/firebase";
import { doc } from 'firebase/firestore';
import { Checkbox } from "./ui/checkbox";


const initialContactSchema = z.object({
  clientName: z.string().min(1, "Client's Name is required."),
  clientAddress: z.string().min(1, "Client's Address is required."),
  aptUnit: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  clientPhone: z.string().min(1, "Client's Phone is required."),
  clientEmail: z.string().email("A valid email is required."),
  mainContact: z.string().optional(),
  allergies: z.string().optional(),
  pets: z.string().optional(),
  dateOfHomeVisit: z.date().optional(),
  timeOfVisit: z.string().optional(),
  referredBy: z.string().optional(),
  promptedCall: z.string().min(1, "This field is required."),
  companionCareNotes: z.string().optional(),
  personalCareNotes: z.string().optional(),
  estimatedHours: z.string().optional(),
  estimatedStartDate: z.date().optional(),
  inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
  inHomeVisitSetNoReason: z.string().optional(),
  medicalIns: z.string().optional(),
  dnr: z.boolean().optional(),
  va: z.string().optional(),
  hasPoa: z.enum(["Yes", "No"]).optional(),
  ltci: z.string().optional(),
  advanceDirective: z.boolean().optional(),
  contactPhone: z.string().optional(),
  languagePreference: z.string().optional(),
});

type InitialContactFormData = z.infer<typeof initialContactSchema>;

export function InitialContactForm({ contactId }: { contactId: string | null }) {
  const [isSubmitting, startSubmittingTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const contactDocRef = useMemoFirebase(() => contactId ? doc(firestore, 'initial_contacts', contactId) : null, [contactId]);
  const { data: existingData, isLoading } = useDoc<any>(contactDocRef);

  const form = useForm<InitialContactFormData>({
    resolver: zodResolver(initialContactSchema),
    defaultValues: {
      clientName: "",
      clientAddress: "",
      aptUnit: "",
      city: "",
      zip: "",
      clientPhone: "",
      clientEmail: "",
      mainContact: "",
      allergies: "",
      pets: "",
      referredBy: "",
      promptedCall: "",
      companionCareNotes: "",
      personalCareNotes: "",
      estimatedHours: "",
      inHomeVisitSetNoReason: "",
      medicalIns: "",
      dnr: false,
      va: "",
      hasPoa: undefined,
      ltci: "",
      advanceDirective: false,
      contactPhone: "",
      languagePreference: "",
    },
  });
  
  useEffect(() => {
    if (existingData) {
        const dateFields = ['dateOfHomeVisit', 'estimatedStartDate'];
        const convertedData = { ...existingData };
        dateFields.forEach(field => {
            if (existingData[field] && typeof existingData[field].toDate === 'function') {
                convertedData[field] = existingData[field].toDate();
            }
        });
        form.reset(convertedData);
    }
  }, [existingData, form]);

  const onSubmit = (data: InitialContactFormData) => {
    startSubmittingTransition(async () => {
      const result = await submitInitialContact({
        contactId: contactId,
        formData: data
      });

      if (result.error) {
        toast({
          title: "Submission Failed",
          description: result.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Initial contact information has been saved.",
        });
        if(window.location.pathname.includes('/admin')) {
          router.push('/admin/assessments');
        } else {
          router.push('/owner/dashboard');
        }
      }
    });
  };

  const inHomeVisitSet = form.watch("inHomeVisitSet");

  if(isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent"/></div>
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Left Column */}
              <div className="space-y-6">
                <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="aptUnit" render={({ field }) => ( <FormItem><FormLabel>Apt/Unit #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="flex gap-4">
                    <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Client's Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Client's Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <FormField control={form.control} name="mainContact" render={({ field }) => ( <FormItem><FormLabel>Main Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="allergies" render={({ field }) => ( <FormItem><FormLabel>Allergies</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="pets" render={({ field }) => ( <FormItem><FormLabel>Pets</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              {/* Right Column */}
              <div className="space-y-6">
                 <Card className="bg-green-100 p-4">
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="dateOfHomeVisit"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date of Home Visit</FormLabel>
                                    <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
                        <FormField control={form.control} name="timeOfVisit" render={({ field }) => ( <FormItem><FormLabel>Time of Visit</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="referredBy" render={({ field }) => ( <FormItem><FormLabel>Referred By</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <FormField control={form.control} name="medicalIns" render={({ field }) => ( <FormItem><FormLabel>Medical Ins</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="dnr" render={({ field }) => ( <FormItem className="flex items-center gap-2 pt-8"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">DNR</FormLabel><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="va" render={({ field }) => ( <FormItem><FormLabel>VA</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="hasPoa" render={({ field }) => ( <FormItem><FormLabel>Has POA</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4"><FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="Yes"/></FormControl><FormLabel className="font-normal">Y</FormLabel></FormItem><FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="No"/></FormControl><FormLabel className="font-normal">N</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="ltci" render={({ field }) => ( <FormItem><FormLabel>LTCI- No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="advanceDirective" render={({ field }) => ( <FormItem className="flex items-center gap-2 pt-8"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Advance Directive</FormLabel><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="contactPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Phone:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="languagePreference" render={({ field }) => ( <FormItem><FormLabel>Language Preference:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </Card>
              </div>
            </div>
            
            <FormField control={form.control} name="promptedCall" render={({ field }) => ( <FormItem><FormLabel>What Prompted the Call In Today:</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem> )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField control={form.control} name="companionCareNotes" render={({ field }) => ( <FormItem><FormLabel>COMPANION CARE</FormLabel><FormControl><Textarea {...field} rows={8} placeholder="Notes on companion care needs..." /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="personalCareNotes" render={({ field }) => ( <FormItem><FormLabel>Personal Care</FormLabel><FormControl><Textarea {...field} rows={8} placeholder="Notes on personal care needs..."/></FormControl><FormMessage /></FormItem> )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <FormField control={form.control} name="estimatedHours" render={({ field }) => ( <FormItem><FormLabel>Estimated Hours:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField
                        control={form.control}
                        name="estimatedStartDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Estimated Start Date:</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
                </div>
                 <div className="space-y-6">
                    <FormField control={form.control} name="inHomeVisitSet" render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Was an In-Home Visit Set?</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4">
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes"/></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No"/></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {inHomeVisitSet === 'No' && (
                         <FormField control={form.control} name="inHomeVisitSetNoReason" render={({ field }) => ( <FormItem><FormLabel>If NO, Why?</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Initial Contact
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
