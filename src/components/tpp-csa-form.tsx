
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
import { Loader2, Send, Save, BookUser, Calendar as CalendarIcon, RefreshCw, Briefcase, FileCheck, Signature, X, Printer, Eye, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendSignatureEmail, finalizeAndSubmit, previewClientIntakePdf, createCsaFromContact, submitClientSignature, saveClientSignupForm } from "@/lib/client-signup.actions";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Checkbox } from "./ui/checkbox";
import { HelpDialog } from "./HelpDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

interface TppCsaFormProps {
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

const SignaturePadModal = ({
    isOpen,
    onClose,
    onSave,
    signatureData,
    title
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    signatureData: string | undefined | null;
    title: string;
}) => {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const [isSigned, setIsSigned] = useState(false);

    useEffect(() => {
        if (isOpen && sigPadRef.current) {
            // Clear previous content
            sigPadRef.current.clear();
            // If existing data is provided, load it.
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
                setIsSigned(true);
            } else {
                setIsSigned(false);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => {
        sigPadRef.current?.clear();
        setIsSigned(false);
    }
    
    const handleDone = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            onSave(sigPadRef.current.toDataURL());
        } else {
             onSave(""); // Save empty if cleared
        }
        onClose();
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="flex-grow p-2">
                    <SignatureCanvas
                        ref={sigPadRef}
                        penColor='black'
                        canvasProps={{ className: 'w-full h-full bg-muted/50 rounded-md' }}
                        onEnd={() => setIsSigned(true)}
                    />
                </div>
                <div className="flex justify-between p-4 border-t">
                    <Button type="button" variant="ghost" onClick={handleClear}>
                        <RefreshCw className="mr-2"/>
                        Clear
                    </Button>
                    <Button type="button" onClick={handleDone}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};


export default function TppCsaForm({ signupId, mode = 'owner' }: TppCsaFormProps) {
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
  
  const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof ClientSignupFormData; title: string; } | null>(null);

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
  
  const watchedSignatures = form.watch([
    'clientSignature',
    'clientRepresentativeSignature',
    'firstLightRepresentativeSignature',
    'agreementClientSignature',
    'agreementRepSignature',
    'transportationWaiverClientSignature',
    'transportationWaiverWitnessSignature',
  ]);

  const isPublished = existingSignupData?.status === 'Signed and Published';

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
      
    }
  }, [existingSignupData, form, isClientMode]);

  useEffect(() => {
    if (isPrintMode && !isLoading) {
      setTimeout(() => window.print(), 500); // Small delay to ensure content renders
    }
  }, [isPrintMode, isLoading]);

  const handleSaveSignature = (dataUrl: string) => {
    if (activeSignature) {
        form.setValue(activeSignature.fieldName, dataUrl, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleSave = async (status: "Incomplete" | "Pending Client Signatures") => {
    const isSendingAction = status === "Pending Client Signatures";
    const draftFields: (keyof ClientSignupFormData)[] = ['clientName', 'clientCity', 'clientState', 'clientPhone', 'clientEmail'];
    const fieldsToValidate = isSendingAction ? undefined : draftFields;
  
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
  
    const transitionAction = isSendingAction ? startSendingTransition : startSavingTransition;
    transitionAction(async () => {
      const result = await saveClientSignupForm({
        signupId: signupId,
        formData: form.getValues(),
        status: status,
        clientEmail: form.getValues('clientEmail'),
      });
      
      if (result.error) {
          toast({ title: "Error", description: result.message, variant: "destructive" });
          return;
      }
      
      const newSignupId = result.docId;
      const dashboardPath = pathname.includes('/admin') ? '/admin/assessments' : '/owner/dashboard';
  
      if (status === 'Incomplete') {
        toast({ title: "Draft Saved", description: "The client intake form has been saved as a draft." });
        if (!signupId && newSignupId) {
            const newPath = pathname.includes('/admin') ? `/admin/tpp-csa?signupId=${newSignupId}` : `/owner/tpp-csa?signupId=${newSignupId}`;
            router.push(newPath);
        }
      } else {
        const emailResult = await sendSignatureEmail(newSignupId!, form.getValues('clientEmail')!);
        if (emailResult.error) {
          toast({ title: "Email Error", description: emailResult.message, variant: "destructive" });
        } else {
          toast({ title: "Success", description: "Form saved and signature link sent to the client." });
        }
        router.push(dashboardPath);
      }
    });
  };

  const handleFinalize = async () => {
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

        const result = await finalizeAndSubmit(signupId, form.getValues());
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
  
  const SignatureField = ({ fieldName, title }: { fieldName: keyof ClientSignupFormData; title: string }) => {
    const signatureData = form.watch(fieldName);
    const disabled = isPublished || (mode === 'owner' && isClientMode);
    
    return (
        <div className="space-y-2">
            <FormLabel>{title}</FormLabel>
            <div className="relative rounded-md border bg-muted/30 h-28 flex items-center justify-center">
                {signatureData ? (
                    <Image src={signatureData as string} alt="Signature" layout="fill" objectFit="contain" />
                ) : (
                    <span className="text-muted-foreground">Not Signed</span>
                )}
                 {!disabled && (
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => setActiveSignature({ fieldName, title })}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                 )}
            </div>
            <FormMessage>{form.formState.errors[fieldName]?.message}</FormMessage>
        </div>
    );
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
                
                 {mode === 'owner' && (
                  <div className="flex justify-end -mb-4">
                    <HelpDialog topic="csa" />
                  </div>
                 )}

                <h2 className="text-2xl font-bold text-center underline">THIRD PARTY PAYOR CLIENT SERVICE AGREEMENT</h2>
                
                {/* We will replace this content in the next steps */}
                <p className="text-sm text-muted-foreground text-center py-16 border-dashed border-2 rounded-lg">
                    Content for the Third Party Payor CSA will be added here based on your provided text.
                </p>

                 <div className="flex justify-end gap-4 pt-6 no-print">
                    {mode === 'owner' && (
                        <>
                            <Button type="button" variant="secondary" onClick={() => handleSave("Incomplete")} disabled={isSaving || isSending || isPublished}>
                                {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                                Save as Incomplete
                            </Button>
                            <Button type="button" onClick={handlePreviewPdf} disabled={isPreviewing || isPublished}>
                                {isPreviewing ? <Loader2 className="mr-2 animate-spin" /> : <Eye className="mr-2" />}
                                View PDF
                            </Button>
                            <Button type="button" onClick={() => handleSave("Pending Client Signatures")} disabled={isSaving || isSending || isPublished}>
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
         {activeSignature && (
            <SignaturePadModal
                isOpen={!!activeSignature}
                onClose={() => setActiveSignature(null)}
                onSave={handleSaveSignature}
                signatureData={form.getValues(activeSignature.fieldName)}
                title={activeSignature.title}
            />
        )}
        <CardFooter className="flex justify-center text-xs text-muted-foreground pt-4 no-print">
            <p>Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.</p>
        </CardFooter>
    </Card>
  );
}
