

"use client";

import * as React from "react";
import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDoc, useMemoFirebase, firestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { clientSignupFormSchema, type ClientSignupFormData } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Save, BookUser, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendSignatureEmail } from "@/lib/client-signup.actions";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Checkbox } from "./ui/checkbox";

export default function ClientSignupForm({ signupId }: { signupId: string | null }) {
  const [isSaving, startSavingTransition] = useTransition();
  const [isSending, startSendingTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const signupDocRef = useMemoFirebase(() => signupId ? doc(firestore, "client_signups", signupId) : null, [signupId]);
  const { data: existingSignupData, isLoading: isSignupLoading } = useDoc<any>(signupDocRef);

  const form = useForm<ClientSignupFormData>({
    resolver: zodResolver(clientSignupFormSchema),
    defaultValues: {
      clientEmail: '',
      clientName: '',
      clientAddress: '',
      clientCity: '',
      clientState: '',
      clientPostalCode: '',
      clientPhone: '',
      clientSSN: '',
      clientDOB: '',
      emergencyContactName: '',
      emergencyContactRelationship: '',
      emergencyContactHomePhone: '',
      emergencyContactWorkPhone: '',
      secondEmergencyContactName: '',
      secondEmergencyContactRelationship: '',
      secondEmergencyContactPhone: '',
      homemakerCompanion: false,
      personalCare: false,
      scheduledFrequency: '',
      daysPerWeek: '',
      hoursPerDay: '',
      contractStartDate: undefined,
    },
  });

  useEffect(() => {
    if (existingSignupData?.formData) {
      const data = {
          ...existingSignupData.formData,
          contractStartDate: existingSignupData.formData.contractStartDate 
              ? new Date(existingSignupData.formData.contractStartDate) 
              : undefined,
      };
      form.reset(data);
    }
  }, [existingSignupData, form]);

  const handleSave = async (status: "INCOMPLETE" | "PENDING CLIENT SIGNATURES") => {
    const isSendingAction = status === "PENDING CLIENT SIGNATURES";
    const transition = isSendingAction ? startSendingTransition : startSavingTransition;

    const isValid = await form.trigger();
    if (!isValid) {
        toast({
            title: "Validation Error",
            description: "Please fill out all required fields before saving or sending.",
            variant: "destructive",
        });
        return;
    }

    transition(async () => {
      const formData = form.getValues();
      
      try {
        let docId = signupId;
        const now = serverTimestamp();
        
        if (docId) {
          const docRef = doc(firestore, 'client_signups', docId);
           const saveData = {
              formData,
              clientEmail: formData.clientEmail,
              status,
              lastUpdatedAt: now,
          };
          await updateDoc(docRef, saveData).catch(serverError => {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
              path: docRef.path, operation: "update", requestResourceData: saveData,
            }));
            throw serverError;
          });

        } else {
          const colRef = collection(firestore, 'client_signups');
          const saveData = {
              formData,
              clientEmail: formData.clientEmail,
              status,
              createdAt: now,
              lastUpdatedAt: now,
          };
          const newDoc = await addDoc(colRef, saveData).catch(serverError => {
            errorEmitter.emit("permission-error", new FirestorePermissionError({
                path: colRef.path, operation: "create", requestResourceData: saveData,
            }));
            throw serverError;
          });
          docId = newDoc.id;
        }

        if (status === 'INCOMPLETE') {
          toast({ title: "Draft Saved", description: "The client intake form has been saved as a draft." });
          if (!signupId) {
            router.push(`/owner/new-client-signup?signupId=${docId}`);
          }
        } else {
          const emailResult = await sendSignatureEmail(docId!, formData.clientEmail);
           if (emailResult.error) {
              toast({ title: "Email Error", description: emailResult.message, variant: "destructive" });
           } else {
              toast({ title: "Success", description: "Form saved and signature link sent to the client." });
           }
          router.push('/owner/dashboard');
        }

      } catch (error: any) {
        if (!error.name?.includes('FirebaseError')) {
           toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
        }
      }
    });
  };

  if (isSignupLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading form...</p>
      </div>
    );
  }

  return (
     <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 pt-4"><BookUser />New Client Intake Form</CardTitle>
            <CardDescription>
            Fill out the details below. You can save a draft or send it to the client for their signature.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form className="space-y-8">
                    <h2 className="text-2xl font-bold text-center">CLIENT SERVICE AGREEMENT</h2>
                    <p className="text-sm text-muted-foreground">
                        Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the "Agreement") is entered into between the client, or his or her authorized representative, (the "Client") and FirstLight Home Care of Rancho Cucamonga CA, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730 phone number 9093214466 ("FirstLight Home Care")
                    </p>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">I. CLIENT INFORMATION</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientCity" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientState" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientPostalCode" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientSSN" render={({ field }) => ( <FormItem><FormLabel>Social Security #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientDOB" render={({ field }) => ( <FormItem><FormLabel>DOB</FormLabel><FormControl><Input {...field} type="date" /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem><FormLabel>Client Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">II. EMERGENCY CONTACT INFORMATION</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="emergencyContactName" render={({ field }) => ( <FormItem><FormLabel>Emergency Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="emergencyContactHomePhone" render={({ field }) => ( <FormItem><FormLabel>Contact Home Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="emergencyContactWorkPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Work Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <FormField control={form.control} name="secondEmergencyContactName" render={({ field }) => ( <FormItem><FormLabel>2nd Emergency Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="secondEmergencyContactRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="secondEmergencyContactPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </div>

                     <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">III. TYPE OF SERVICE</h3>
                        <div className="flex gap-8 justify-center">
                            <FormField control={form.control} name="homemakerCompanion" render={({ field }) => (
                                <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Homemaker/Companion</FormLabel></FormItem>
                            )} />
                            <FormField control={form.control} name="personalCare" render={({ field }) => (
                                <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Personal Care</FormLabel></FormItem>
                            )} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">IV. SCHEDULE</h3>
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <FormField control={form.control} name="scheduledFrequency" render={({ field }) => ( <FormItem><FormLabel>Scheduled Frequency</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="daysPerWeek" render={({ field }) => ( <FormItem><FormLabel>Days/Wk</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="hoursPerDay" render={({ field }) => ( <FormItem><FormLabel>Hrs/Day</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField
                                control={form.control}
                                name="contractStartDate"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Contract Start Date</FormLabel>
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
                    </div>

                    <p className="text-sm text-muted-foreground">
                        "FirstLight Home Care of Rancho Cucamonga will provide non-medical in-home services (the "Services") specified in the attached Service Plan Agreement (the "Service Plan")"
                    </p>

                    <div className="flex justify-end gap-4 pt-6">
                        <Button type="button" variant="secondary" onClick={() => handleSave("INCOMPLETE")} disabled={isSaving || isSending}>
                            {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                            Save as Incomplete
                        </Button>
                        <Button type="button" onClick={() => handleSave("PENDING CLIENT SIGNATURES")} disabled={isSaving || isSending}>
                            {isSending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                            Save and Send for Signature
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4">
            <p>Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.</p>
        </CardFooter>
    </Card>
  );
}
