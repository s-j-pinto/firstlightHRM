
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
      policyNumber: "",
      policyPeriod: "",
      clientInitials: "",
      clientSignature: "",
      clientPrintedName: "",
      clientSignatureDate: undefined,
      clientRepresentativeSignature: "",
      clientRepresentativePrintedName: "",
      clientRepresentativeSignatureDate: undefined,
      firstLightRepresentativeSignature: "",
      firstLightRepresentativeTitle: "",
      firstLightRepresentativeSignatureDate: undefined,
      receivedPrivacyPractices: false,
      receivedClientRights: false,
      receivedAdvanceDirectives: false,
      receivedRateSheet: false,
      receivedTransportationWaiver: false,
      receivedPaymentAgreement: false,
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
          clientSignatureDate: existingSignupData.formData.clientSignatureDate
              ? new Date(existingSignupData.formData.clientSignatureDate)
              : undefined,
          clientRepresentativeSignatureDate: existingSignupData.formData.clientRepresentativeSignatureDate
              ? new Date(existingSignupData.formData.clientRepresentativeSignatureDate)
              : undefined,
          firstLightRepresentativeSignatureDate: existingSignupData.formData.firstLightRepresentativeSignatureDate
              ? new Date(existingSignupData.formData.firstLightRepresentativeSignatureDate)
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
                                <div className="space-y-2">
                                    <FormLabel>(Client Signature)</FormLabel>
                                    <div className="rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.clientSignature} canvasProps={{ className: 'w-full h-24' }} />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(sigPads.clientSignature)}><RefreshCw className="mr-2" />Clear</Button>
                                </div>
                                <FormField control={form.control} name="clientPrintedName" render={({ field }) => ( <FormItem><FormLabel>(Client Printed Name)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="clientSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            </div>
                             {/* Representative Signature Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2">
                                    <FormLabel>(Client Representative Signature)</FormLabel>
                                    <div className="rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.clientRepresentativeSignature} canvasProps={{ className: 'w-full h-24' }} />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(sigPads.clientRepresentativeSignature)}><RefreshCw className="mr-2" />Clear</Button>
                                </div>
                                 <FormField control={form.control} name="clientRepresentativePrintedName" render={({ field }) => ( <FormItem><FormLabel>(Client Representative Printed Name and Relationship to Client)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                 <FormField control={form.control} name="clientRepresentativeSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            </div>
                            {/* FirstLight Signature Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="space-y-2">
                                    <FormLabel>(FirstLight Home Care of Representative Signature)</FormLabel>
                                    <div className="rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.firstLightRepresentativeSignature} canvasProps={{ className: 'w-full h-24' }} />
                                    </div>
                                     <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(sigPads.firstLightRepresentativeSignature)}><RefreshCw className="mr-2" />Clear</Button>
                                </div>
                                 <FormField control={form.control} name="firstLightRepresentativeTitle" render={({ field }) => ( <FormItem><FormLabel>(FirstLight Home Care of Rancho Cucamonga Representative Title)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                 <FormField control={form.control} name="firstLightRepresentativeSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">TERMS AND CONDITIONS</h3>
                        <ol className="space-y-4 text-sm text-muted-foreground list-decimal list-inside">
                            <li><strong>BUSINESS OPERATIONS:</strong> FirstLight Home Care of Rancho Cucamonga is independently owned and operated as a franchisee of FirstLight Home Care Franchising, LLC. FirstLight Home Care of Rancho Cucamonga is licensed by the California Department of Social Services as a Home Care Organization (as defined in Cal. Health & Safety Code § 1796.12) and is in compliance with California Department of Social Services requirements, including registration and background check requirements for home care aids who work for Home Care Organizations.</li>
                            <li><strong>FIRSTLIGHT CONTACT INFORMATION:</strong> If you have any questions, problems, needs or concerns, please contact the FirstLight Home Care of Rancho Cucamonga 's designated representative, Lolita Pinto at phone number 9093214466 or by mail sent to the address above.</li>
                            <li><strong>COMPLAINTS:</strong> To file a complaint, you may contact the FirstLight Home Care of Rancho Cucamonga 's representative listed above. You may also contact the California Department of Social Services at 1-877-424-5778.</li>
                            <li><strong>ABUSE REPORTING:</strong> Reports of abuse, neglect or financial exploitation may be made to local law enforcement or the county Adult Protective Services office or local law enforcement. FirstLight Home Care of Rancho Cucamonga will report any suspected or known dependent adult or elder abuse as required by Section 15630 of the Welfare and Institutions Code and suspected or known child abuse as required by Sections 11164 to 11174.3 of the Penal Code. A copy of each suspected abuse report shall be maintained.</li>
                            <li><strong>DEPOSIT FOR SERVICES:</strong> A deposit in the amount sufficient to pay for at least two weeks of the Services may be required prior to the initiation of Services. Services are billed weekly and are due seven days after receipt of invoice. If hours increase the Client may be requested to make an additional deposit equaling the amount of hours added. Should hours decrease, the deposit will not be refunded until completion of Services. If for any reason Services are provided and payment has not been made in full to FirstLight Home Care of Rancho Cucamonga it is agreed the Client will pay all reasonable costs incurred by FirstLight Home Care of Rancho Cucamonga to collect said monies due, including collection fees, attorney fees and any other expenses incurred in the collection of all charges on the Client's account. If the Client utilizes ACH or Credit Card as the payment source a deposit may not be required.</li>
                            <li><strong>HOLIDAY CHARGES:</strong> The 24 hour period constituting the following holidays may be billed at 1.5 times the regular hourly (or flat) rate. Please see RATE SHEET for additional information.</li>
                            <li><strong>OVERTIME CHARGES:</strong> FirstLight Home Care of Rancho Cucamonga 's work week begins on Monday at 12:00 am and ends 11:59 pm on Sunday. If the Client requests an In-Home Worker to work over 8 hours per work day the Client may be billed at 1.5 times the regular hourly rate or at such other amounts necessary for FirstLight Home Care of Rancho Cucamonga to meet its obligations under state and federal wage and hour laws. Additional fees may apply if the Client requests a "live in" employee.</li>
                            <li><strong>INFORMATION REQUESTS:</strong> FirstLight Home Care of Rancho Cucamonga will adhere to a written policy addressing the confidentiality and permitted uses and disclosure of client records. Response to an inquiry or information request is normally done during business hours; however, inquiries or information requests made during evenings, weekends, or holidays will be addressed on the next business day.</li>
                            <li><strong>EMERGENCY TREATMENT:</strong> FirstLight Home Care of Rancho Cucamonga In-Home Workers are not qualified or authorized to provide medical care or attention of any kind. If a medical emergency arises while a FirstLight Home Care of Rancho Cucamonga In-Home Worker is present, the In-Home Worker is instructed to call for emergency assistance. The Client holds harmless FirstLight Home Care of Rancho Cucamonga and its employees, agents, representatives, and affiliates for any medical attention provided resulting from instructions given by emergency service operators.</li>
                            <li><strong>EMERGENCY CONTACT:</strong> At the Client's instruction, or if it appears to a FirstLight Home Care of Rancho Cucamonga In-Home Worker that a life-threatening or medical emergency may have occurred while a FirstLight Home Care of Rancho Cucamonga In-Home Worker is present, FirstLight Home Care of Rancho Cucamonga will immediately notify the appropriate emergency responders (9-1-1) and, as soon as reasonably feasible, the Client's Emergency Contact(s) indicated above.</li>
                            <li><strong>INSURANCE:</strong> Client agrees to maintain homeowners or renters insurance on the Client's residence, which shall include coverages for dwelling, personal property and liability. Client agrees that such insurance shall be primary to and non- contributory with any other insurance that may cover claims, loss, or damages arising out of this Agreement or relating to the services provided hereunder. Client expressly releases and waives any and all rights of subrogation, contribution or indemnity the insurer may have against FirstLight Home Care of Rancho Cucamonga or its employees, agents, representatives, and affiliates. Client represents and certifies that the following insurance is in effect as of the date of this Agreement: Homeowners'/Renters' Insurance Company
                                <div className="grid grid-cols-2 gap-4 my-2">
                                    <FormField control={form.control} name="policyNumber" render={({ field }) => ( <FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="policyPeriod" render={({ field }) => ( <FormItem><FormLabel>Policy Period</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                The Client agrees not to entrust a FirstLight Home Care of Rancho Cucamonga In-Home Worker with unattended premises or any part thereof, or with the care, custody, or control of cash, negotiable, or other valuables without the prior written permission of FirstLight Home Care of Rancho Cucamonga and then only when the FirstLight Home Care of Rancho Cucamonga In-Home Worker's specific duties necessitate such activities.
                            </li>
                            <li><strong>USE OF PREMISES:</strong> Client shall not do or suffer or permit anything to be done in or about the location where the Services are to be provided (the "Premises") which would in any way subject FirstLight Home Care of Rancho Cucamonga, its employees, agents, representatives, and affiliates to any liability or cause a cancellation of, or give rise to any defense by an insurer to any claim under, or conflict with, any policies for homeowners' or renters' insurance. Client shall not do or permit anything to be done in or about the Premises which will in any way conflict with any law, ordinance or governmental requirement now in force or which may hereafter be enacted. Client shall immediately furnish FirstLight Home Care of Rancho Cucamonga with any notices received from any insurance company or governmental agency or inspection bureau regarding any unsafe or unlawful conditions within the Premises. Client will indemnify, defend and hold harmless FirstLight Home Care of Rancho Cucamonga, any related entities, its affiliates, and each of their directors, officers, and employees ("Indemnified Persons") from and against any and all claims, actions, demands, liabilities, losses, damages, judgments, costs and expenses, including but not limited to, reasonable attorneys' fees, costs and interest, asserted against, imposed upon or incurred by Indemnified Persons that arise out of, or in connection with, the Client's failure to perform the obligations of this Section 12.</li>
                            <li><strong>USE OF VEHICLE:</strong> FirstLight Home Care of Rancho Cucamonga will not operate a vehicle on the Client's behalf unless the Client executes the Transportation Waiver substantially in the form provided by FirstLight Home Care of Rancho Cucamonga as part of this Agreement.</li>
                            <li><strong>HIRING:</strong> The investment FirstLight Home Care of Rancho Cucamonga makes in maintaining our quality caregivers and employees is substantial; therefore, it is agreed for a period of one year from the last day worked or for a period of one year after the Client stops utilizing FirstLight Home Care of Rancho Cucamonga Services, the Client agrees not to hire directly, or hire through any other company or agency, FirstLight Home Care of Rancho Cucamonga employees directly or indirectly who have personally provided care for the Client. If the Client wishes to hire a FirstLight Home Care of Rancho Cucamonga employee directly, the Client will notify FirstLight Home Care of Rancho Cucamonga of this intent in writing and a flat fee of $15,000.00 will be required to hire that employee directly. A written request by said employee will be required and must be approved by FirstLight Home Care of Rancho Cucamonga
                                <div className="w-1/3 mt-2">
                                     <FormField control={form.control} name="clientInitials" render={({ field }) => ( <FormItem><FormLabel>Client Initials</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                            </li>
                            <li><strong>OTHER CONSIDERATIONS:</strong> The Client agrees that any claims made under the FirstLight Home Care of Rancho Cucamonga fidelity bond must be made in writing by the Client with ten (10) days of the occurrence. In addition, as a licensed California Home Care Organization FirstLight Home Care of Rancho Cucamonga maintains proof of general and professional liability insurance in the amount of $1 million per occurrence and $3 million in the aggregate and has an employee dishonesty bond with a minimum limit of $10,000, as required under Cal. Health & Safety Code § 1796.37; 1796.42.</li>
                            <li><strong>TERM; TERMINATION:</strong> The term of this Agreement will be from the Contract Start Date until this Agreement is terminated under this section. Either party may terminate this Agreement at any time by providing seven (7) days' prior written notice to the other party stating the reason for termination. In instances of safety risk/hazard to a Client or a FirstLight Home Care of Rancho Cucamonga In-Home Worker or provision of the Services is otherwise prohibited by law, termination will be immediate with a stated reason for termination provided to the other party at the time of notification.</li>
                            <li><strong>AMENDMENT; ENTIRE AGREEMENT:</strong> The Client agrees to notify FirstLight Home Care of Rancho Cucamonga of any requested changes in the duties of a FirstLight Home Care of Rancho Cucamonga employee from those agreed to on the Service Plan. This Agreement may be amended only upon the mutual written consent of the parties. This Agreement represents the entire agreement of the parties with respect to the subject matter hereof, and this Agreement supersedes all prior agreements and understandings with respect to such subject matter.</li>
                            <li><strong>SEVERABILITY:</strong> The invalidity or partial invalidity of any portion of this Agreement will not invalidate the remainder thereof, and said remainder will remain in full force and effect. Moreover, if one or more of the provisions contained in this Agreement will, for any reason, be held to be excessively broad as to scope, activity, subject or otherwise, so as to be unenforceable at law, such provision or provisions will be construed by the appropriate judicial body by limiting or reducing it or them, so as to be enforceable to the maximum extent compatible with then applicable law.</li>
                            <li><strong>INFORMATION AND DOCUMENTS RECEIVED:</strong> The Client acknowledges receipt of a copy of this Agreement, these Terms and Conditions and the following documents provided by FirstLight Home Care of Rancho Cucamonga and agrees to be bound by and comply with all of the same:
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                     <FormField control={form.control} name="receivedPrivacyPractices" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Notice of Privacy Practices</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="receivedClientRights" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Client Rights and Responsibilities</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="receivedAdvanceDirectives" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Advance Directives</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="receivedRateSheet" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Rate Sheet</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="receivedTransportationWaiver" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Transportation Waiver</FormLabel></FormItem>)} />
                                     <FormField control={form.control} name="receivedPaymentAgreement" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Agreement to Accept Payment Responsibility and Consent for Personal Information-Private Pay</FormLabel></FormItem>)} />
                                </div>
                            </li>
                        </ol>
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

