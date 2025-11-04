

"use client";

import * as React from "react";
import { useState, useTransition, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDoc, useMemoFirebase, firestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, addDoc, updateDoc, collection, serverTimestamp, Timestamp, getDocs, query, where } from 'firebase/firestore';
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import SignatureCanvas from 'react-signature-canvas';
import Image from "next/image";


import { clientSignupFormSchema, finalizationSchema, type ClientSignupFormData } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Save, BookUser, Calendar as CalendarIcon, RefreshCw, Briefcase, FileCheck, Signature, X, Printer, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendSignatureEmail, finalizeAndSubmit, previewClientIntakePdf, submitClientSignature, createCsaFromContact } from "@/lib/client-signup.actions";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Checkbox } from "./ui/checkbox";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

interface ClientSignupFormProps {
    signupId: string | null;
    mode?: 'owner' | 'client-signing' | 'print';
}

const PrintHeader = () => (
    <div className="print-header-content hidden print:block">
      <div className="flex items-center justify-between">
        <Image src={logoUrl} alt="FirstLight Home Care Logo" width={200} height={40} />
        <span className="text-red-500 font-bold">NO. 00000</span>
      </div>
    </div>
);

const PrintFooter = () => (
    <div className="print-footer-content hidden print:block text-xs text-gray-500">
        <div className="flex justify-between w-full">
            <span>Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.</span>
            <span>FIRST-0084-A (10/2018)</span>
        </div>
    </div>
);


export default function ClientSignupForm({ signupId, mode = 'owner' }: ClientSignupFormProps) {
  const [isSaving, startSavingTransition] = useTransition();
  const [isSending, startSendingTransition] = useTransition();
  const [isFinalizing, startFinalizingTransition] = useTransition();
  const [isSubmitting, startSubmittingTransition] = useTransition();
  const [isPreviewing, startPreviewingTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const isClientMode = mode === 'client-signing';
  const isPrintMode = mode === 'print';


  const signupDocRef = useMemoFirebase(() => signupId ? doc(firestore, 'client_signups', signupId) : null, [signupId]);
  const { data: existingSignupData, isLoading } = useDoc<any>(signupDocRef);

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
      daysPerWeek: '',
      hoursPerDay: '',
      contractStartDate: undefined,
      hourlyRate: 0,
      minimumHoursPerShift: 0,
      rateCardDate: undefined,
      policyNumber: "",
      policyPeriod: "",
      clientInitials: "",
      receivedPrivacyPractices: false,
      receivedClientRights: false,
      receivedTransportationWaiver: false,
      receivedPaymentAgreement: false,
      clientSignature: "",
      clientPrintedName: "",
      clientSignatureDate: undefined,
      clientRepresentativeSignature: "",
      clientRepresentativePrintedName: "",
      clientRepresentativeSignatureDate: undefined,
      firstLightRepresentativeSignature: "",
      firstLightRepresentativeTitle: "",
      firstLightRepresentativeSignatureDate: undefined,
      // Service Plan
      companionCare_mealPreparation: false,
      companionCare_cleanKitchen: false,
      companionCare_assistWithLaundry: false,
      companionCare_dustFurniture: false,
      companionCare_assistWithEating: false,
      companionCare_provideAlzheimersRedirection: false,
      companionCare_assistWithHomeManagement: false,
      companionCare_preparationForBathing: false,
      companionCare_groceryShopping: false,
      companionCare_cleanBathrooms: false,
      companionCare_changeBedLinens: false,
      companionCare_runErrands: false,
      companionCare_escortAndTransportation: false,
      companionCare_provideRemindersAndAssistWithToileting: false,
      companionCare_provideRespiteCare: false,
      companionCare_stimulateMentalAwareness: false,
      companionCare_assistWithDressingAndGrooming: false,
      companionCare_assistWithShavingAndOralCare: false,
      companionCare_other: "",
      personalCare_provideAlzheimersCare: false,
      personalCare_provideMedicationReminders: false,
      personalCare_assistWithDressingGrooming: false,
      personalCare_assistWithBathingHairCare: false,
      personalCare_assistWithFeedingSpecialDiets: false,
      personalCare_assistWithMobilityAmbulationTransfer: false,
      personalCare_assistWithIncontinenceCare: false,
      personalCare_assistWithOther: "",
      servicePlanClientInitials: "",
      // Office Use Only
      officeTodaysDate: undefined,
      officeReferralDate: undefined,
      officeInitialContactDate: undefined,
      // Agreement
      agreementClientName: "",
      agreementClientSignature: "",
      agreementSignatureDate: undefined,
      agreementRelationship: "",
      agreementRepSignature: "",
      agreementRepDate: undefined,
      // Transportation Waiver
      transportationWaiverClientSignature: "",
      transportationWaiverClientPrintedName: "",
      transportationWaiverWitnessSignature: "",
      transportationWaiverDate: undefined,
    },
  });

  const sigPads = {
    clientSignature: useRef<SignatureCanvas>(null),
    clientRepresentativeSignature: useRef<SignatureCanvas>(null),
    firstLightRepresentativeSignature: useRef<SignatureCanvas>(null),
    agreementClientSignature: useRef<SignatureCanvas>(null),
    agreementRepSignature: useRef<SignatureCanvas>(null),
    transportationWaiverClientSignature: useRef<SignatureCanvas>(null),
    transportationWaiverWitnessSignature: useRef<SignatureCanvas>(null),
  };
  
  const isPublished = existingSignupData?.status === 'SIGNED AND PUBLISHED';

  // Watch the main clientName field and auto-populate others
  const clientNameValue = form.watch('clientName');
  useEffect(() => {
    form.setValue('agreementClientName', clientNameValue, { shouldValidate: true });
    if(isClientMode){
        form.setValue('clientPrintedName', clientNameValue, { shouldValidate: true });
        form.setValue('transportationWaiverClientPrintedName', clientNameValue, { shouldValidate: true });
    }
  }, [clientNameValue, form, isClientMode]);


  useEffect(() => {
    if (existingSignupData?.formData) {
        const formData = existingSignupData.formData;
        const dateFields = [
            'contractStartDate', 'rateCardDate', 'clientSignatureDate',
            'clientRepresentativeSignatureDate', 'firstLightRepresentativeSignatureDate',
            'officeTodaysDate', 'officeReferralDate', 'officeInitialContactDate',
            'agreementSignatureDate', 'agreementRepDate', 'transportationWaiverDate'
        ];

        const convertedData: { [key: string]: any } = { ...formData };
        
        // Convert Timestamps to Dates and nulls/undefined to empty strings/0 for controlled components
        Object.keys(convertedData).forEach(key => {
            const typedKey = key as keyof typeof convertedData;
            let value = convertedData[typedKey];

            if (dateFields.includes(typedKey)) {
                if (value && typeof (value as any).toDate === 'function') {
                    convertedData[typedKey] = (value as any).toDate();
                } else if (value && typeof value === 'string') {
                    const parsedDate = new Date(value);
                    convertedData[typedKey] = !isNaN(parsedDate.getTime()) ? parsedDate : undefined;
                } else if (!value) {
                    convertedData[typedKey] = undefined;
                }
            } else if (value === null) {
                 // Determine default empty value based on schema type if possible
                const fieldSchema = (clientSignupFormSchema.shape as any)[typedKey];
                if (fieldSchema && fieldSchema._def.typeName === 'ZodNumber') {
                    convertedData[typedKey] = 0;
                } else if (fieldSchema && fieldSchema._def.typeName === 'ZodBoolean') {
                    convertedData[typedKey] = false;
                } else {
                    convertedData[typedKey] = '';
                }
            }
        });
        
        if (isClientMode) {
            // Pre-populate dates for client signing if they aren't already set
            if (!convertedData.clientSignatureDate) {
                convertedData.clientSignatureDate = new Date();
            }
             if (!convertedData.clientRepresentativeSignatureDate) {
                convertedData.clientRepresentativeSignatureDate = new Date();
            }
            if (!convertedData.agreementSignatureDate) {
                convertedData.agreementSignatureDate = new Date();
            }
             if (convertedData.receivedTransportationWaiver && !convertedData.transportationWaiverDate) {
                convertedData.transportationWaiverDate = new Date();
            }
        }

      form.reset(convertedData);

      Object.keys(sigPads).forEach(key => {
        const padKey = key as keyof typeof sigPads;
        const formKey = key as keyof ClientSignupFormData;
        const sigPad = sigPads[padKey].current;
        const sigData = formData[formKey];
        if (sigPad && sigData) {
            setTimeout(() => sigPad.fromDataURL(sigData), 100);
        }
      });
    }
  }, [existingSignupData, form, isClientMode]);

  useEffect(() => {
    if (isPrintMode && !isLoading) {
      setTimeout(() => window.print(), 500); // Small delay to ensure content renders
    }
  }, [isPrintMode, isLoading]);


  const handleSave = async (status: "INCOMPLETE" | "PENDING CLIENT SIGNATURES") => {
    const isSendingAction = status === "PENDING CLIENT SIGNATURES";
    const draftFields: (keyof ClientSignupFormData)[] = ['clientName', 'clientCity', 'clientState', 'clientPhone', 'clientEmail'];
    const fieldsToValidate = isSendingAction ? undefined : draftFields;
  
    const transitionAction = isSendingAction ? startSendingTransition : startSavingTransition;
  
    // Manually trigger validation before sanitizing
    const isValid = await form.trigger(fieldsToValidate);
  
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: `Please fill out all required fields before ${isSendingAction ? 'sending' : 'saving'}.`,
        variant: "destructive",
      });
      return;
    }
  
    transitionAction(async () => {
      Object.keys(sigPads).forEach(key => {
        const padKey = key as keyof typeof sigPads;
        const formKey = key as keyof ClientSignupFormData;
        const pad = sigPads[padKey].current;
        if (pad && !pad.isEmpty()) {
            form.setValue(formKey, pad.toDataURL());
        }
      });

      const finalFormData = form.getValues();
      const sanitizedDataForFirestore: {[key: string]: any} = { ...finalFormData };
      
       // Sanitize data for Firestore
      Object.keys(sanitizedDataForFirestore).forEach(key => {
        const typedKey = key as keyof typeof sanitizedDataForFirestore;
        const value = sanitizedDataForFirestore[typedKey];
        if (value === undefined) {
          (sanitizedDataForFirestore as any)[typedKey] = null;
        } else if (value === '') {
          // Keep empty strings for text fields but nullify for optional numbers if needed
          const fieldSchema = (clientSignupFormSchema.shape as any)[typedKey];
          if (fieldSchema && fieldSchema._def.typeName === 'ZodOptional' && fieldSchema.unwrap()._def.typeName === 'ZodNumber') {
            (sanitizedDataForFirestore as any)[typedKey] = null;
          }
        }
      });
  
      try {
        let docId = signupId;
        const now = serverTimestamp();
  
        if (docId) {
          const docRef = doc(firestore, 'client_signups', docId);
          const saveData = {
            formData: sanitizedDataForFirestore,
            clientEmail: sanitizedDataForFirestore.clientEmail,
            clientPhone: sanitizedDataForFirestore.clientPhone,
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
            formData: sanitizedDataForFirestore,
            clientEmail: sanitizedDataForFirestore.clientEmail,
            clientPhone: sanitizedDataForFirestore.clientPhone,
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

        const dashboardPath = pathname.includes('/admin') ? '/admin/assessments' : '/owner/dashboard';
  
        if (status === 'INCOMPLETE') {
          toast({ title: "Draft Saved", description: "The client intake form has been saved as a draft." });
          if (!signupId) {
             const newPath = pathname.includes('/admin') ? `/admin/new-client-signup?signupId=${docId}` : `/owner/new-client-signup?signupId=${docId}`;
             router.push(newPath);
          }
        } else {
          const emailResult = await sendSignatureEmail(docId!, sanitizedDataForFirestore.clientEmail!);
          if (emailResult.error) {
            toast({ title: "Email Error", description: emailResult.message, variant: "destructive" });
          } else {
            toast({ title: "Success", description: "Form saved and signature link sent to the client." });
          }
          router.push(dashboardPath);
        }
  
      } catch (error: any) {
        if (!error.name?.includes('FirebaseError')) {
          toast({ title: "Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
        }
      }
    });
  };

  const handleFinalize = async () => {
    Object.keys(sigPads).forEach(key => {
        const padKey = key as keyof typeof sigPads;
        const formKey = key as keyof ClientSignupFormData;
        const pad = sigPads[padKey].current;
        if (pad && !pad.isEmpty()) {
            form.setValue(formKey, pad.toDataURL(), { shouldValidate: true });
        }
    });
    
    // Explicitly trigger validation against the stricter schema
    const isValid = await form.trigger();
    const validationResult = finalizationSchema.safeParse(form.getValues());
    
    if (!validationResult.success) {
      console.error("Finalization validation errors:", validationResult.error.flatten().fieldErrors);
      toast({
        title: "Validation Failed",
        description: "Please fill out all required fields before finalizing. Check all signatures, dates, initials and payment info.",
        variant: "destructive",
        duration: 8000,
      });
       // Manually set form errors to make them visible
      for (const [key, messages] of Object.entries(validationResult.error.flatten().fieldErrors)) {
        if (messages) {
          form.setError(key as keyof ClientSignupFormData, { type: 'manual', message: messages.join(', ') });
        }
      }
      return;
    }

    startFinalizingTransition(async () => {
        if (!signupId) {
            toast({ title: "Error", description: "No document ID found to finalize." });
            return;
        }

        const result = await finalizeAndSubmit(signupId);
        if (result.error) {
            toast({ title: "Finalization Failed", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success!", description: result.message });
            if (result.completedPdfUrl) {
                window.open(result.completedPdfUrl, '_blank');
            }
        }
    });
  }

  const handleClientSubmit = () => {
    startSubmittingTransition(async () => {
        if (!signupId) return;
        
        Object.keys(sigPads).forEach(key => {
            const padKey = key as keyof typeof sigPads;
            const formKey = key as keyof ClientSignupFormData;
            const pad = sigPads[padKey].current;
            if (pad && !pad.isEmpty()) {
                form.setValue(formKey, pad.toDataURL(), { shouldValidate: true });
            }
        });

        const payload = {
            signupId,
            signature: form.getValues('clientSignature'),
            repSignature: form.getValues('clientRepresentativeSignature'),
            agreementSignature: form.getValues('agreementClientSignature'),
            printedName: form.getValues('clientPrintedName'),
            date: form.getValues('clientSignatureDate') || new Date(),
            repPrintedName: form.getValues('clientRepresentativePrintedName'),
            repDate: form.getValues('clientRepresentativeSignatureDate'),
            initials: form.getValues('clientInitials'),
            servicePlanClientInitials: form.getValues('servicePlanClientInitials'),
            agreementRelationship: form.getValues('agreementRelationship'),
            agreementDate: form.getValues('agreementSignatureDate'),
            transportationWaiverClientSignature: form.getValues('transportationWaiverClientSignature'),
            transportationWaiverClientPrintedName: form.getValues('transportationWaiverClientPrintedName'),
            transportationWaiverWitnessSignature: form.getValues('transportationWaiverWitnessSignature'),
            transportationWaiverDate: form.getValues('transportationWaiverDate'),
        };

        const result = await submitClientSignature(payload);

        if (result.error) {
            toast({ title: "Submission Failed", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Submission Successful", description: result.message });
            router.push('/new-client/dashboard');
        }
    });
  };

  const handlePreviewPdf = () => {
    startPreviewingTransition(async () => {
      const formData = form.getValues();
      try {
        const result = await previewClientIntakePdf(formData);
        
        if (result.pdfData) {
          const byteCharacters = atob(result.pdfData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } else {
          console.error("Preview failed, error:", result.error);
          toast({
            title: "Preview Failed",
            description: result.error || "Could not generate PDF preview.",
            variant: "destructive"
          });
        }
      } catch (e: any) {
        console.error("Caught error during preview:", e);
        toast({
          title: "Preview Generation Error",
          description: `An unexpected client-side error occurred: ${e.message}`,
          variant: "destructive"
        });
      }
    });
  };


  const clearSignature = (sigPadRef: React.RefObject<SignatureCanvas>) => {
    sigPadRef.current?.clear();
  };
  
  const receivedTransportationWaiver = form.watch('receivedTransportationWaiver');

  const companionCareCheckboxes = [
    { id: 'companionCare_mealPreparation', label: 'Meal preparation and clean up' },
    { id: 'companionCare_cleanKitchen', label: 'Clean kitchen - appliances, sinks, mop floors' },
    { id: 'companionCare_assistWithLaundry', label: 'Assist with laundry and ironing' },
    { id: 'companionCare_dustFurniture', label: 'Dust furniture - living room, bedrooms, dining room' },
    { id: 'companionCare_assistWithEating', label: 'Assist with eating and proper nutrition' },
    { id: 'companionCare_provideAlzheimersRedirection', label: "Provide Alzheimer's redirection - for safety" },
    { id: 'companionCare_assistWithHomeManagement', label: 'Assist with home management - mail, plants, calendar' },
    { id: 'companionCare_preparationForBathing', label: 'Preparation for bathing and hair care' },
    { id: 'companionCare_groceryShopping', label: 'Grocery shopping' },
    { id: 'companionCare_cleanBathrooms', label: 'Clean bathrooms - sink, tub, toilet' },
    { id: 'companionCare_changeBedLinens', label: 'Change bed linens and make bed' },
    { id: 'companionCare_runErrands', label: 'Run errands - pick up prescription' },
    { id: 'companionCare_escortAndTransportation', label: 'Escort and transportation' },
    { id: 'companionCare_provideRemindersAndAssistWithToileting', label: 'Provide reminders and assist with toileting' },
    { id: 'companionCare_provideRespiteCare', label: 'Provide respite care' },
    { id: 'companionCare_stimulateMentalAwareness', label: 'Stimulate mental awareness - read' },
    { id: 'companionCare_assistWithDressingAndGrooming', label: 'Assist with dressing and grooming' },
    { id: 'companionCare_assistWithShavingAndOralCare', label: 'Assist with shaving and oral care' },
  ] as const;

  const personalCareCheckboxes = [
    { id: 'personalCare_provideAlzheimersCare', label: "Provide Alzheimer's care, cognitive impairment" },
    { id: 'personalCare_provideMedicationReminders', label: 'Provide medication reminders' },
    { id: 'personalCare_assistWithDressingGrooming', label: 'Assist with dressing, grooming' },
    { id: 'personalCare_assistWithBathingHairCare', label: 'Assist with bathing, hair care' },
    { id: 'personalCare_assistWithFeedingSpecialDiets', label: 'Assist with feeding, special diets' },
    { id: 'personalCare_assistWithMobilityAmbulationTransfer', label: 'Assist with mobility, ambulation and transfer' },
    { id: 'personalCare_assistWithIncontinenceCare', label: 'Assist with incontinence care' },
  ] as const;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading form...</p>
      </div>
    );
  }

  const formContent = (
     <div className="printable-area">
        <PrintHeader />
        <PrintFooter />

        <Form {...form}>
            <form className="space-y-8">
                <h2 className="text-2xl font-bold text-center">CLIENT SERVICE AGREEMENT</h2>
                <p className="text-sm text-muted-foreground">
                    Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the "Agreement") is entered into between the client, or his or her authorized representative, (the "Client") and FirstLight Home Care of Rancho Cucamonga CA, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730 phone number 9093214466 ("FirstLight Home Care")
                </p>

                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-center">I. CLIENT INFORMATION</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientCity" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientState" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientPostalCode" render={({ field }) => ( <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientSSN" render={({ field }) => ( <FormItem><FormLabel>Social Security #</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientDOB" render={({ field }) => ( <FormItem><FormLabel>DOB</FormLabel><FormControl><Input {...field} type="date" value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem><FormLabel>Client Email</FormLabel><FormControl><Input {...field} type="email" value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="emergencyContactName" render={({ field }) => ( <FormItem><FormLabel>Emergency Contact Name</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="emergencyContactHomePhone" render={({ field }) => ( <FormItem><FormLabel>Contact Home Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="emergencyContactWorkPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Work Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="secondEmergencyContactName" render={({ field }) => ( <FormItem><FormLabel>2nd Emergency Contact</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="secondEmergencyContactRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="secondEmergencyContactPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                <div className="space-y-6">
                     <div className="flex gap-8 justify-center">
                        <FormField control={form.control} name="homemakerCompanion" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal">Homemaker/Companion</FormLabel></FormItem>
                        )} />
                        <FormField control={form.control} name="personalCare" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal">Personal Care</FormLabel></FormItem>
                        )} />
                    </div>
                </div>

                <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                         <div className="flex flex-col space-y-2 pt-2 self-end">
                            <FormLabel>Scheduled Frequency:</FormLabel>
                        </div>
                        <FormField control={form.control} name="daysPerWeek" render={({ field }) => ( <FormItem><FormLabel>Days/Wk</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="hoursPerDay" render={({ field }) => ( <FormItem><FormLabel>Hrs/Day</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField
                            control={form.control}
                            name="contractStartDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Contract Start Date</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} />
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
                    <h3 className="text-lg font-semibold text-center">II. PAYMENTS FOR THE SERVICES</h3>
                    <div className="space-y-4 rounded-md border p-4">
                        <div className="flex flex-wrap items-baseline gap-2">
                            <p className="text-sm">The hourly rate for providing the Services is $</p>
                            <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                                <FormItem className="inline-flex">
                                    <FormControl><Input {...field} type="number" className="w-24 h-8" value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <p className="text-sm">per hour. The rate is based on the Client utilizing the services of FirstLight Home Care of Rancho Cucamonga for a minimum of</p>
                            <FormField control={form.control} name="minimumHoursPerShift" render={({ field }) => (
                                <FormItem className="inline-flex">
                                    <FormControl><Input {...field} type="number" className="w-20 h-8" value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <p className="text-sm">hours per shift. The rates are provided on a current rate card dated</p>
                            <FormField control={form.control} name="rateCardDate" render={({ field }) => (
                                <FormItem className="inline-flex">
                                    <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button variant={"outline"} size="sm" className={cn("pl-3 text-left font-normal h-8", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} />
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
                    <p className="text-sm p-3 rounded-md bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800">
                        If there is same day cancellation, client will be charged for full scheduled hours, except if there is a medical emergency.
                    </p>
                </div>
                
                <div className="space-y-6 break-before-page">
                    <h3 className="text-lg font-semibold text-center">III. ACKNOWLEDGEMENT & AGREEMENT</h3>
                     <p className="text-sm text-muted-foreground">
                        The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the "Terms and Conditions" and all other attached documents, all of which are incorporated into this Agreement.
                    </p>
                    <div className="space-y-8">
                        {/* Client Signature Section */}
                        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 items-end p-4 rounded-md", isClientMode && "border border-orange-400")}>
                            <div className="space-y-2">
                                <FormLabel>(Client Signature)</FormLabel>
                                <div className="relative rounded-md border bg-white">
                                    {form.getValues('clientSignature') && (isPublished || mode === 'owner') ?
                                        <Image src={form.getValues('clientSignature')} alt="Signature" width={200} height={100} className="w-full h-24 object-contain" /> :
                                        <SignatureCanvas ref={sigPads.clientSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isPublished} />
                                    }
                                    {!isPublished && (
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.clientSignature)}>
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <FormMessage>{form.formState.errors.clientSignature?.message}</FormMessage>
                            </div>
                            <FormField control={form.control} name="clientPrintedName" render={({ field }) => ( <FormItem><FormLabel>(Client Printed Name)</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="clientSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                        {/* Representative Signature Section */}
                        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 items-end p-4 rounded-md", isClientMode && "border border-orange-400")}>
                            <div className="space-y-2">
                                <FormLabel>(Client Representative Signature)</FormLabel>
                                <div className="relative rounded-md border bg-white">
                                     {form.getValues('clientRepresentativeSignature') && (isPublished || mode === 'owner') ?
                                        <Image src={form.getValues('clientRepresentativeSignature')} alt="Signature" width={200} height={100} className="w-full h-24 object-contain" /> :
                                        <SignatureCanvas ref={sigPads.clientRepresentativeSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isPublished} />
                                    }
                                    {!isPublished && (
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.clientRepresentativeSignature)}>
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <FormMessage>{form.formState.errors.clientRepresentativeSignature?.message}</FormMessage>
                            </div>
                            <FormField control={form.control} name="clientRepresentativePrintedName" render={({ field }) => ( <FormItem><FormLabel>(Client Representative Printed Name and Relationship to Client)</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="clientRepresentativeSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                        {/* FirstLight Signature Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div className="space-y-2">
                                <FormLabel>(FirstLight Home Care of Representative Signature)</FormLabel>
                                <div className="relative rounded-md border bg-white">
                                    <SignatureCanvas ref={sigPads.firstLightRepresentativeSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isClientMode || isPublished} />
                                    {!isPublished && !isClientMode && (
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.firstLightRepresentativeSignature)}>
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <FormMessage>{form.formState.errors.firstLightRepresentativeSignature?.message}</FormMessage>
                            </div>
                            <FormField control={form.control} name="firstLightRepresentativeTitle" render={({ field }) => ( <FormItem><FormLabel>(FirstLight Home Care of Rancho Cucamonga Representative Title)</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="firstLightRepresentativeSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                </div>

                <div className="space-y-6 break-before-page">
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
                                <FormField control={form.control} name="policyNumber" render={({ field }) => ( <FormItem><FormLabel>Policy Number</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="policyPeriod" render={({ field }) => ( <FormItem><FormLabel>Policy Period</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            The Client agrees not to entrust a FirstLight Home Care of Rancho Cucamonga In-Home Worker with unattended premises or any part thereof, or with the care, custody, or control of cash, negotiable, or other valuables without the prior written permission of FirstLight Home Care of Rancho Cucamonga and then only when the FirstLight Home Care of Rancho Cucamonga In-Home Worker's specific duties necessitate such activities.
                        </li>
                        <li><strong>USE OF PREMISES:</strong> Client shall not do or suffer or permit anything to be done in or about the location where the Services are to be provided (the "Premises") which would in any way subject FirstLight Home Care of Rancho Cucamonga, its employees, agents, representatives, and affiliates to any liability or cause a cancellation of, or give rise to any defense by an insurer to any claim under, any policies for homeowners' or renters' insurance. Client shall not do or permit anything to be done in or about the Premises which will in any way conflict with any law, ordinance or governmental requirement now in force or which may hereafter be enacted. Client shall immediately furnish FirstLight Home Care of Rancho Cucamonga with any notices received from any insurance company or governmental agency or inspection bureau regarding any unsafe or unlawful conditions within the Premises. Client will indemnify, defend and hold harmless FirstLight Home Care of Rancho Cucamonga, any related entities, its affiliates, and each of their directors, officers, and employees ("Indemnified Persons") from and against any and all claims, actions, demands, liabilities, losses, damages, judgments, costs and expenses, including but not to, reasonable attorneys' fees, costs and interest, asserted against, imposed upon or incurred by Indemnified Persons that arise out of, or in connection with, the Client's failure to perform the obligations of this Section 12.</li>
                        <li><strong>USE OF VEHICLE:</strong> FirstLight Home Care of Rancho Cucamonga will not operate a vehicle on the Client's behalf unless the Client executes the Transportation Waiver substantially in the form provided by FirstLight Home Care of Rancho Cucamonga as part of this Agreement.</li>
                        <li><strong>HIRING:</strong> The investment FirstLight Home Care of Rancho Cucamonga makes in maintaining our quality caregivers and employees is substantial; therefore, it is agreed for a period of one year from the last day worked or for a period of one year after the Client stops utilizing FirstLight Home Care of Rancho Cucamonga Services, the Client agrees not to hire directly, or hire through any other company or agency, FirstLight Home Care of Rancho Cucamonga employees directly or indirectly who have personally provided care for the Client. If the Client wishes to hire a FirstLight Home Care of Rancho Cucamonga employee directly, the Client will notify FirstLight Home Care of Rancho Cucamonga of this intent in writing and a flat fee of $15,000.00 will be required to hire that employee directly. A written request by said employee will be required and must be approved by FirstLight Home Care of Rancho Cucamonga
                            <div className="w-1/3 mt-2">
                                <FormField control={form.control} name="clientInitials" render={({ field }) => ( <FormItem><FormLabel>Client Initials</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </li>
                        <li><strong>OTHER CONSIDERATIONS:</strong> The Client agrees that any claims made under the FirstLight Home Care of Rancho Cucamonga fidelity bond must be made in writing by the Client with ten (10) days of the occurrence. In addition, as a licensed California Home Care Organization FirstLight Home Care of Rancho Cucamonga maintains proof of general and professional liability insurance in the amount of $1 million per occurrence and $3 million in the aggregate and has an employee dishonesty bond with a minimum limit of $10,000, as required under Cal. Health & Safety Code § 1796.37; 1796.42.</li>
                        <li><strong>TERM; TERMINATION:</strong> The term of this Agreement will be from the Contract Start Date until this Agreement is terminated under this section. Either party may terminate this Agreement at any time by providing seven (7) days' prior written notice to the other party stating the reason for termination. In instances of safety risk/hazard to a Client or a FirstLight Home Care of Rancho Cucamonga In-Home Worker or provision of the Services is otherwise prohibited by law, termination will be immediate with a stated reason for termination provided to the other party at the time of notification.</li>
                        <li><strong>AMENDMENT; ENTIRE AGREEMENT:</strong> The Client agrees to notify FirstLight Home Care of Rancho Cucamonga of any requested changes in the duties of a FirstLight Home Care of Rancho Cucamonga employee from those agreed to on the Service Plan. This Agreement may be amended only upon the mutual written consent of the parties. This Agreement represents the entire agreement of the parties with respect to the subject matter hereof, and this Agreement supersedes all prior agreements and understandings with respect to such subject matter.</li>
                        <li><strong>SEVERABILITY:</strong> The invalidity or partial invalidity of any portion of this Agreement will not invalidate the remainder thereof, and said remainder will remain in full force and effect. Moreover, if one or more of the provisions contained in this Agreement will, for any reason, be held to be excessively broad as to scope, activity, subject or otherwise, so as to be unenforceable at law, such provision or provisions will be construed by the appropriate judicial body by limiting or reducing it or them, so as to be enforceable to the maximum extent compatible with then applicable law.</li>
                        <li><strong>INFORMATION AND DOCUMENTS RECEIVED:</strong> The Client acknowledges receipt of a copy of this Agreement, these Terms and Conditions and the following documents provided by FirstLight Home Care of Rancho Cucamonga and agrees to be bound by and comply with all of the same:
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <FormField control={form.control} name="receivedPrivacyPractices" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal">Notice of Privacy Practices</FormLabel><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="receivedClientRights" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal">Client Rights and Responsibilities</FormLabel><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="receivedTransportationWaiver" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal">Transportation Waiver</FormLabel><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="receivedPaymentAgreement" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal">Agreement to Accept Payment Responsibility and Consent for Personal Information-Private Pay</FormLabel><FormMessage /></FormItem>)} />
                            </div>
                        </li>
                    </ol>
                </div>
                
                {receivedTransportationWaiver && (
                    <div className="space-y-6 break-before-page">
                        <h3 className="text-lg font-semibold text-center">Transportation Waiver</h3>
                        <p className="text-sm">FirstLight HomeCare offers transportation as a convenience to our clients, not as a standalone service.</p>
                        <p className="text-sm">Upon signing of this waiver, I understand I am authorizing an employee of FirstLight HomeCare to furnish transportation for me as a passenger in either their automobile or my own.</p>
                        <p className="text-sm">I will follow all applicable laws, including, but not limited to, the wearing of my seatbelt.</p>
                        <p className="text-sm">When the FirstLight HomeCare employee drives my vehicle, I certify current insurance for both liability and physical damage.</p>
                        <p className="text-sm">Further, I accept responsibility for any deductibles on my personal automobile insurance coverage incurred as a result of this service.</p>
                        <p className="text-sm">I specifically accept these risks and waive any claim that I might otherwise have against FirstLight HomeCare with respect to bodily injury or property damage sustained by me in connection with said transportation, and hereby expressly release FirstLight HomeCare and their employees from any and all liability therewith.</p>
                        
                        <div className="space-y-8 pt-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <FormField control={form.control} name="transportationWaiverClientPrintedName" render={({ field }) => ( <FormItem><FormLabel>Printed Name</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                                <div className="space-y-2">
                                    <FormLabel>Signed (Client or Responsible Party)</FormLabel>
                                    <div className="relative rounded-md border bg-white">
                                        <SignatureCanvas ref={sigPads.transportationWaiverClientSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isPublished} />
                                        {!isPublished && (
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.transportationWaiverClientSignature)}>
                                                <RefreshCw className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage>{form.formState.errors.transportationWaiverClientSignature?.message}</FormMessage>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <div className="space-y-2">
                                    <FormLabel>Witness (FirstLight Home Care Representative)</FormLabel>
                                    <div className="relative rounded-md border bg-white">
                                        {form.getValues('transportationWaiverWitnessSignature') && (isPublished || isClientMode) ?
                                            <Image src={form.getValues('transportationWaiverWitnessSignature')} alt="Signature" width={200} height={100} className="w-full h-24 object-contain" /> :
                                            <SignatureCanvas ref={sigPads.transportationWaiverWitnessSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isClientMode || isPublished} />
                                        }
                                        {!isPublished && !isClientMode && (
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.transportationWaiverWitnessSignature)}>
                                                <RefreshCw className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage>{form.formState.errors.transportationWaiverWitnessSignature?.message}</FormMessage>
                                </div>
                                <FormField control={form.control} name="transportationWaiverDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-6 break-before-page">
                    <h3 className="text-lg font-semibold text-center">HOME CARE SERVICE PLAN AGREEMENT</h3>
                    <div className="border p-4 rounded-md space-y-4 bg-muted/20">
                        <h3 className="text-lg font-semibold text-center">For Office Use Only</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name="officeTodaysDate" render={({ field }) => ( <FormItem><FormLabel>TODAY'S DATE</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="officeReferralDate" render={({ field }) => ( <FormItem><FormLabel>REFERRAL DATE</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="officeInitialContactDate" render={({ field }) => ( <FormItem><FormLabel>DATE OF INITIAL CLIENT CONTACT</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                    <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client Name:</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled /></FormControl></FormItem> )} />
                    <p className="text-sm text-muted-foreground">Frequency and duration of Services to be identified on individualized Client Service Plan</p>
                    <div className="space-y-4">
                        <h4 className="font-semibold">Companion Care Services</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {companionCareCheckboxes.map(item => (
                                <FormField key={item.id} control={form.control} name={item.id} render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal text-sm">{item.label}</FormLabel></FormItem>
                                )} />
                            ))}
                        </div>
                        <FormField control={form.control} name="companionCare_other" render={({ field }) => ( <FormItem><FormLabel>Other:</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold">Personal Care Services</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {personalCareCheckboxes.map(item => (
                                <FormField key={item.id} control={form.control} name={item.id} render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClientMode || isPublished} /></FormControl><FormLabel className="font-normal text-sm">{item.label}</FormLabel></FormItem>
                                )} />
                            ))}
                        </div>
                        <FormField control={form.control} name="personalCare_assistWithOther" render={({ field }) => ( <FormItem><FormLabel>Assist with other:</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <p className="text-sm text-muted-foreground">Firstlight Home Care of Rancho Cucamonga provides Personal Care Services as defined under Cal. Health & Safety Code § 1796.12 and does not provide medical services or function as a home health agency.</p>
                    <div className="w-1/3 mt-2">
                        <FormField control={form.control} name="servicePlanClientInitials" render={({ field }) => ( <FormItem><FormLabel>Client Initials</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>
                
                <div className="space-y-6 break-before-page">
                    <h3 className="text-lg font-semibold text-center">AGREEMENT TO ACCEPT PAYMENT RESPONSIBILITY AND CONSENT FOR USE AND DISCLOSURE OF PERSONAL INFORMATION-PRIVATE PAY</h3>
                    <FormField control={form.control} name="agreementClientName" render={({ field }) => ( <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled /></FormControl><FormMessage /></FormItem> )} />
                    <p className="text-sm text-muted-foreground">I understand that Firstlight Home Care of Rancho Cucamonga may need to use or disclose my personal information to provide services to me, to obtain payment for its services and for all of the other reasons more fully described in Firstlight Home Care of Rancho Cucamonga Notice of Privacy Practices.</p>
                    <p className="text-sm text-muted-foreground">I acknowledge that I have received the Notice of Privacy Practices, and I consent to all of the uses and disclosures of my personal information as described in that document including, if applicable and as is necessary, for Firstlight Home Care of Rancho Cucamonga provide services to me; to coordinate with my other providers; to determine eligibility for payment, bill, and receive payment for services; and to make all other uses and disclosures described in the Notice of Privacy Practices.</p>
                    <p className="text-sm text-muted-foreground">My consent will be valid for two (2) years from the date below. I may revoke my consent to share information, in writing, at any time. Revoking my consent does not apply to information that has already been shared or affect my financial responsibility for Services. I understand that some uses and sharing of my information are authorized by law and do not require my consent.</p>
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-8 items-end p-4 rounded-md", isClientMode && "border border-orange-400")}>
                        <div className="space-y-2">
                            <FormLabel>Client Signature/Responsible Party</FormLabel>
                            <div className="relative rounded-md border bg-white">
                                {form.getValues('agreementClientSignature') && (isPublished || mode === 'owner') ?
                                    <Image src={form.getValues('agreementClientSignature')} alt="Signature" width={200} height={100} className="w-full h-24 object-contain" /> :
                                    <SignatureCanvas ref={sigPads.agreementClientSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isPublished} />
                                }
                                {!isPublished && (
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.agreementClientSignature)}>
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                            <FormMessage>{form.formState.errors.agreementClientSignature?.message}</FormMessage>
                        </div>
                        <FormField control={form.control} name="agreementSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                    </div>
                     <div className={cn("p-4 rounded-md", isClientMode && "border border-orange-400")}>
                        <FormField control={form.control} name="agreementRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship if not Client</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div className="space-y-2">
                            <FormLabel>FirstLight Home Care of Rancho Cucamonga Representative</FormLabel>
                            <div className="relative rounded-md border bg-white">
                                <SignatureCanvas ref={sigPads.agreementRepSignature} canvasProps={{ className: 'w-full h-24' }} disabled={isClientMode || isPublished} />
                                {!isPublished && !isClientMode && (
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => clearSignature(sigPads.agreementRepSignature)}>
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                            <FormMessage>{form.formState.errors.agreementRepSignature?.message}</FormMessage>
                        </div>
                        <FormField control={form.control} name="agreementRepDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                    </div>
                </div>

                 <div className="flex justify-end gap-4 pt-6 no-print">
                    {mode === 'owner' && (
                        <>
                            <Button type="button" variant="secondary" onClick={() => handleSave("INCOMPLETE")} disabled={isSaving || isSending || isPublished}>
                                {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                                Save as Incomplete
                            </Button>
                            <Button type="button" onClick={handlePreviewPdf} disabled={isPreviewing || isPublished}>
                                {isPreviewing ? <Loader2 className="mr-2 animate-spin" /> : <Eye className="mr-2" />}
                                View PDF
                            </Button>
                            <Button type="button" onClick={() => handleSave("PENDING CLIENT SIGNATURES")} disabled={isSaving || isSending || isPublished}>
                                {isSending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                                Save and Send for Signature
                            </Button>
                            <Button type="button" variant="default" onClick={handleFinalize} disabled={isFinalizing || isPublished}>
                                {isFinalizing ? <Loader2 className="mr-2 animate-spin" /> : <FileCheck className="mr-2" />}
                                Submit and Finalize
                            </Button>
                             {isPublished && (
                                <Button type="button" onClick={() => window.open(existingSignupData.completedPdfUrl, '_blank')} >
                                    <Printer className="mr-2" />
                                    View Final PDF
                                </Button>
                            )}
                        </>
                    )}
                    {isClientMode && (
                        <>
                            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting || isPublished}>
                                <X className="mr-2" />
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleClientSubmit} disabled={isSubmitting || isPublished}>
                                {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Signature className="mr-2" />}
                                Submit Signature
                            </Button>
                        </>
                    )}
                </div>
            </form>
        </Form>
    </div>
  );

  if (isPrintMode) {
    return formContent;
  }

  return (
     <Card>
        <CardContent className="pt-6">
           {formContent}
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4 no-print">
            <p>Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.</p>
        </CardFooter>
    </Card>
  );
}
