

"use client";

import * as React from "react";
import { useState, useTransition, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDoc, useMemoFirebase, firestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import SignatureCanvas from 'react-signature-canvas';


import { clientSignupFormSchema, type ClientSignupFormData } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Save, BookUser, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
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
      hourlyRate: undefined,
      minimumHoursPerShift: undefined,
      rateCardDate: undefined,
      clientSignature: "",
      clientPrintedName: "",
      clientSignatureDate: undefined,
      clientRepresentativeSignature: "",
      clientRepresentativePrintedName: "",
      clientRepresentativeSignatureDate: undefined,
      firstLightRepresentativeSignature: "",
      firstLightRepresentativeTitle: "",
      firstLightRepresentativeSignatureDate: undefined,
    },
  });

  const sigPads = {
    clientSignature: useRef<SignatureCanvas>(null),
    clientRepresentativeSignature: useRef<SignatureCanvas>(null),
    firstLightRepresentativeSignature: useRef<SignatureCanvas>(null),
  };

  useEffect(() => {
    if (existingSignupData?.formData) {
      const data = {
          ...existingSignupData.formData,
          contractStartDate: existingSignupData.formData.contractStartDate 
              ? new Date(existingSignupData.formData.contractStartDate) 
              : undefined,
          rateCardDate: existingSignupData.formData.rateCardDate
              ? new Date(existingSignupData.formData.rateCardDate)
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
    
    // Set signature data from refs just before saving
    Object.keys(sigPads).forEach(key => {
        const padKey = key as keyof typeof sigPads;
        const formKey = key as keyof ClientSignupFormData;
        const pad = sigPads[padKey].current;
        if (pad && !pad.isEmpty()) {
            form.setValue(formKey, pad.toDataURL());
        }
    });

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

  const clearSignature = (sigPadRef: React.RefObject<SignatureCanvas>) => {
    sigPadRef.current?.clear();
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
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
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

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">V. PAYMENTS FOR THE SERVICES</h3>
                        <div className="space-y-4 rounded-md border p-4">
                            <div className="flex flex-wrap items-baseline gap-2">
                                <p className="text-sm">The hourly rate for providing the Services is $</p>
                                <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                                    <FormItem className="inline-flex">
                                        <FormControl><Input {...field} type="number" className="w-24 h-8" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <p className="text-sm">per hour. The rate is based on the Client utilizing the services of FirstLight Home Care of Rancho Cucamonga for a minimum of</p>
                                 <FormField control={form.control} name="minimumHoursPerShift" render={({ field }) => (
                                    <FormItem className="inline-flex">
                                        <FormControl><Input {...field} type="number" className="w-20 h-8" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <p className="text-sm">hours per shift. The rates are provided on a current rate card dated</p>
                                <FormField control={form.control} name="rateCardDate" render={({ field }) => (
                                    <FormItem className="inline-flex">
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button variant={"outline"} size="sm" className={cn("pl-3 text-left font-normal h-8", !field.value && "text-muted-foreground")}>
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
                                )} />
                                 <p className="text-sm">and will be used to calculate the Client's rate for Services. Rates are subject to change with two (2) weeks' written notice (See attached rate sheet.).</p>
                            </div>

                        </div>
                         <p className="text-sm text-muted-foreground">
                            Invoices are to be presented on a regular scheduled basis. Payment is due upon receipt or not more than seven days after an invoice has been received by the Client. The Client should submit payment to the address listed above. Full refunds of any advance deposit fees collected for unused services will occur within ten (10) business days of last date of service. FirstLight Home Care of Rancho Cucamonga does not participate in and is not credentialed with any government or commercial health insurance plans and therefore does not submit bills or claims for Services as in-network, out-of-network or any other status to any government or commercial health plans. Client acknowledges and agrees that Client does not have insurance through any government health insurance plan; that Client requests to pay for Services out-of-pocket; and that because FirstLight Home Care of Rancho Cucamonga does not participate in or accept any form of government or commercial health insurance, FirstLight Home Care of Rancho Cucamonga will bill Client directly for the Services and Client is responsible for paying such charges.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            If there is same day cancellation, client will be charged for full scheduled hours, except if there is a medical emergency.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">ACKNOWLEDGEMENT & AGREEMENT</h3>
                        <p className="text-sm text-muted-foreground">
                            The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the "Terms and Conditions" and all other attached documents, all of which are incorporated into this Agreement.
                        </p>
                        <div className="space-y-8">
                             {/* Client Signature Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2 col-span-2">
                                    <FormLabel>(Client Signature)</FormLabel>
                                    <div className="rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.clientSignature} canvasProps={{ className: 'w-full h-24' }} />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(sigPads.clientSignature)}><RefreshCw className="mr-2" />Clear</Button>
                                </div>
                                <FormField control={form.control} name="clientPrintedName" render={({ field }) => ( <FormItem><FormLabel>(Client Printed Name)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                             {/* Representative Signature Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2 col-span-2">
                                    <FormLabel>(Client Representative Signature)</FormLabel>
                                    <div className="rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.clientRepresentativeSignature} canvasProps={{ className: 'w-full h-24' }} />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(sigPads.clientRepresentativeSignature)}><RefreshCw className="mr-2" />Clear</Button>
                                </div>
                                 <FormField control={form.control} name="clientRepresentativePrintedName" render={({ field }) => ( <FormItem><FormLabel>(Client Representative Printed Name and Relationship to Client)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            {/* FirstLight Signature Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2 col-span-2">
                                    <FormLabel>(FirstLight Home Care of Representative Signature)</FormLabel>
                                    <div className="rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.firstLightRepresentativeSignature} canvasProps={{ className: 'w-full h-24' }} />
                                    </div>
                                     <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(sigPads.firstLightRepresentativeSignature)}><RefreshCw className="mr-2" />Clear</Button>
                                </div>
                                 <FormField control={form.control} name="firstLightRepresentativeTitle" render={({ field }) => ( <FormItem><FormLabel>(FirstLight Home Care of Rancho Cucamonga Representative Title)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </div>
                    </div>


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
