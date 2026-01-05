

"use client";

import * as React from "react";
import { useState, useTransition, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDoc, useMemoFirebase, firestore } from "@/firebase";
import { doc } from 'firebase/firestore';
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

  const terms = [
    { title: "1. BUSINESS OPERATIONS:", text: "FirstLight Home Care is independently owned and operated as a franchisee of FirstLight Home Care Franchising, LLC. FirstLight Home Care meets all requirements of the State of California to provide non-medical in-home personal care, companion and homemaker services. Additional information about FirstLight Home Care that is required to be disclosed under the state law can be found in Section 15 of this Agreement." },
    { title: "2. FIRSTLIGHT CONTACT INFORMATION:", text: "If you have any question, problems, needs or concerns, please contact the FirstLight Home Care of Rancho Cucamonga contact Lolita Pinto at 9093214466 or by mail sent to the address above." },
    { title: "3. COMPLAINTS:", text: "To file a complaint, you may contact the manager listed above or the appropriate State reporting agency. In cases of allegations of abuse or neglect by an employee of FirstLight Home Care a complete investigation will be completed as soon as possible, and FirstLight Home Care will complete a written report within 14 days of the initial complaint unless state law requires earlier reporting in which case that requirements shall apply. The written report shall include the date, time, and description of alleged abuse, neglect, or financial exploitation; description of any injury or abuse of the Client; any actions taken by FirstLight Home Care; a description of actions taken to prevent  future abuse or other crime, or when death (other than by disease or actual causes) has occurred." },
    { title: "4. ABUSE REPORTING:", text: "Reports of abuse, neglect or financial exploitation may be made by Client at any time to local law enforcement. FirstLight Home Care will report any suspected or known dependent adult or elder abuse and otherwise comply with all mandatory reporting laws including, but not limited to, to making reports to law enforcement if an allegation of physical abuse, sexual abuse or other crime, or when death (other than by disease or actual causes) has occurred." },
    { title: "5. INFORMATION REQUESTS:", text: "FirstLight Home Care will adhere to a written policy addressing the confidentiality and permitted uses and disclosure of Client records as well as applicable provisions of state and federal law and its Payor Agreement. Response to an inquiry or information request is normally done during business hours however, inquiries or information requests made during evenings, weekends, or holidays will be addressed on the next business day." },
    { title: "6. EMERGENCY TREATMENT:", text: "FirstLight Home Care caregivers and employees are not licensed, qualified or authorized to provide medical care or attention of any kind. If a medical emergency arises while a FirstLight Home Care employee is present, the employee is instructed to call for emergency assistance. The Client holds harmless FirstLight Home Care and its employees, agents, representatives, and affiliates for any medical attention provided resulting from instructions given by emergency services operators." },
    { title: "7. EMERGENCY CONTACT:", text: "At the Client's instruction, or if it appears to a FirstLight Home Care employee that a life-threatening or medical emergency may have occurred while a FirstLight Home Care employee is present, FirstLight Home Care will immediately notify the appropriate emergency responders (9-1-1) and, as soon as reasonable feasible, the Client's Emergency Contact(s) indicated above." },
    { title: "8. USE OF PREMISES:", text: "Client shall not do or suffer or permit anything to be done in or about the location where the Services are to be provided (the \"Premises\") which would in any way subject FirstLight Home Care of Rancho Cucamonga, its employees, agents, representatives, and affiliates to any liability or cause a cancellation of, or give rise to any defense by an insurer to any claim under, any policies for homeowners' or renters' insurance. Client shall not do or permit anything to be done in or about the Premises which will in any way conflict with any law, ordinance or governmental requirement now in force or which may hereafter be enacted. Client shall immediately furnish FirstLight Home Care of Rancho Cucamonga with any notices received from any insurance company or governmental agency or inspection bureau regarding any unsafe or unlawful conditions within the Premises. Client will indemnify, defend and hold harmless FirstLight Home Care of Rancho Cucamonga, any related entities, its affiliates, and each of their directors, officers, and employees (\"Indemnified Persons\") from and against any and all claims, actions, demands, liabilities, losses, damages, judgments, costs and expenses, including but not to, reasonable attorneys' fees, costs and interest, asserted against, imposed upon or incurred by Indemnified Persons that arise out of, or in connection with, the Client's failure to perform the obligations of this Section 12." },
    { title: "9. USE OF VEHICLE:", text: "FirstLight Home Care of Rancho Cucamonga will not operate a vehicle on the Client's behalf unless the Client executes the Transportation Waiver substantially in the form provided by FirstLight Home Care of Rancho Cucamonga as part of this Agreement." },
    { title: "10. HIRING:", text: "The investment FirstLight Home Care makes in recruiting, training, developing, and maintaining employees as quality caregiver is a substantial cost of maintaining its business model and excellent service to clients. Client agrees, therefore, that except upon notice and the payment of a development fee as describes further below in this paragraph Client will not hire or otherwise utilize directly in any way, nor hire or engage or contract through any other company or agency for, the services of any employee of FirstLight Home Care for the restricted period of: i) one year from the last day worked by the employee for FirstLight Home Care; or ii) one year after the client stops utilizing FirstLight Home Care services, whichever ends sooner. If Client wishes to hire or otherwise engage the services of an employee before the expiration of the applicable one year restricted period above, Client must first provide written notice of such intent and payment in full of development fee of $15,000.00 to FirstLight Home Care. Hiring or otherwise utilizing directly or engaging or contracting for the services of an employee in contravention of this paragraph is a material breach of this agreement. In the event of such breach Client agrees to be liable for an award of money damages to FirstLight Home Care and for any and all other remedies available." },
    { title: "11. OTHER CONSIDERATIONS:", text: "The Client agrees that any claims made under the FirstLight Home Care fidelity bond must be made in writing by the Client within ten (10) days of the occurrence or such longer period of time if required under applicable provisions of state law." },
    { title: "12. TERM; TERMINATION:", text: "The term of this Agreement will be from the Contract Start Date until this Agreement is terminated under this section. Either party may terminate this Agreement at any time by providing seven (7) days' prior written notice to the other party stating the reason for termination. In instances of safety risk/hazard to a Client or a FirstLight Home Care of Rancho Cucamonga In-Home Worker or provision of the Services is otherwise prohibited by law, termination will be immediate with a stated reason for termination provided to the other party at the time of notification. Notwithstanding the foregoing, FirstLight Home Care will comply with all the obligations under state law and the terms of its agreement with Payor as pertains to termination of this Agreement and nothing in this section 12 shall permit FirstLight Home Care to violate its commitment to Payors under the Payor Agreement." },
    { title: "13. AMENDMENT; ENTIRE AGREEMENT:", text: "The Client agrees to notify FirstLight Home Care of any requested changes in the duties of a FirstLight Home Care employee from those agreed to on the Client's plan of care or authorization from Payor. This Agreement may be amended only upon the mutual written consent of the parties. This Agreement represents the entire agreement of Client and FirstLight Home Care with respect to such subject matter. FirstLight Home Care acknowledges that Client's financial responsibility is governed by the Payor Agreement." },
    { title: "14. SEVERABILITY:", text: "The invalidity or partial invalidity of any portion of this Agreement will not invalidate the remainder thereof, and said remainder will remain in full force and effect. Moreover, if one or more of the provisions contained in this Agreement will, for any reason, be held to be excessively broad as to scope, activity, subject or otherwise, so as to be unenforceable at law, such provision or provisions will be construed by the appropriate judicial body by limiting or reducing it or them, so as to be enforceable to the maximum extent compatible with then applicable law." },
    { title: "15. INFORMATION AND DOCUMENTS RECEIVED:", text: "The Client acknowledges receipt of a copy of this Agreement, these Terms and Conditions and the following documents provided by FirstLight Home Care of Rancho Cucamonga and agrees to be bound by and comply with all of the same:" },
];

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
                
                <p className="text-sm">Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (this "Agreement") is entered into between the client, or his or her authorized representative, (the “Client”) and <strong>FirstLight Home Care of Rancho Cucamonga</strong> (“FirstLight Home Care”).</p>
                
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-center">I. CLIENT INFORMATION</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField
                            control={form.control}
                            name="officeTodaysDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>
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
                     <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <FormField control={form.control} name="clientCity" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientState" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientPostalCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientDOB" render={({ field }) => ( <FormItem><FormLabel>DOB</FormLabel><FormControl><Input {...field} type="date" value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="emergencyContactName" render={({ field }) => ( <FormItem><FormLabel>Emergency Contact Name</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="emergencyContactHomePhone" render={({ field }) => ( <FormItem><FormLabel>Contact Home Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="emergencyContactWorkPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Work Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="secondEmergencyContactName" render={({ field }) => ( <FormItem><FormLabel>2nd Emergency Contact</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="secondEmergencyContactRelationship" render={({ field }) => ( <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <FormField control={form.control} name="secondEmergencyContactPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                </div>

                <p className="text-sm"><strong>FirstLight Home Care</strong> will provide non-medical in-hime services (the “services”) specified in the Payor’s authorization and/or Client plan of care as made available by Payor to FirstLight Home Care pursuant to the “Payor Agreement”  (as defined below). It is anticipated that Payor will provide Client-specific information to FirstLightHome Care as part of the Payor’s authorization and/or Client plan of care as FirstLight Home Care needs to render the Services and be reimbursed for such Services by the Payor. However Client will cooperate with FirstLight Home Care to the extent FirstLight Home Care requires additional information from Client related to Client in order to provide the Services.</p>

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
                                <FormLabel>Services Start Date</FormLabel>
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

                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-center">II. PAYMENTS FOR THE SERVICES</h3>
                    <div className="space-y-4 rounded-md border p-4">
                        <div className="flex flex-wrap items-baseline gap-2">
                           <FormField control={form.control} name="payor" render={({ field }) => (
                                <FormItem className="inline-flex items-baseline">
                                    <FormControl><Input {...field} placeholder="Payor Name" className="w-48 h-8" value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <p className="text-sm">(“Payor”) will reimburse FirstLight Home Care
agreement between FirstLight Home Care and Payor (“Payor Agreement”). FirstLight Home Care will submit claims to Payor in
accordance with the provisions of the Payor Agreement and applicable requirements under state or federal law. To the extent
Client owes FirstLight Home Care for any cost sharing or other financial obligation for the Services, such amounts shall be 
determined by Payor in accordance with the Payor Agreement and applicable provisions of state and federal law. Client agrees to notify 
FirstLight Home Care if Client becomes ineligible to receive the Services under this Agreement. Additional service (payable 
by Client out of pocket and not covered by Payor) (the “Private Pay Services”) can be arranged upon Client request; provided,
however, that FirstLight Home Care’s ability to render Private Pay Services depends on the Payor Agreement and applicable
provisions of state and federal law. A separate FirstLight Home Care Private Pay Client Service Agreement must be executed prior to initiation of Private Pay Services.</p>
                        </div>
                    </div>
                </div>
                
                 <div className="space-y-6 break-before-page">
                    <h3 className="text-lg font-semibold text-center">III. ACKNOWLEDGEMENT & AGREEMENT</h3>
                     <p className="text-sm">
                        The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the "Terms and Conditions" and all other attached documents, all of which are incorporated into this Agreement.
                    </p>
                    <div className="space-y-8">
                        {/* Client Signature Section */}
                        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 items-end p-4 rounded-md", isClientMode && "border border-orange-400")}>
                            <SignatureField fieldName="clientSignature" title="Signed (Client)" />
                            <FormField control={form.control} name="clientPrintedName" render={({ field }) => ( <FormItem><FormLabel>Printed Name (Client)</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="clientSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                        {/* Representative Signature Section */}
                        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6 items-end p-4 rounded-md", isClientMode && "border border-orange-400")}>
                            <SignatureField fieldName="clientRepresentativeSignature" title="Signed (Responsible Party)" />
                            <FormField control={form.control} name="clientRepresentativePrintedName" render={({ field }) => ( <FormItem><FormLabel>Printed Name (Client Representative)</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="clientRepresentativeSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                        {/* FirstLight Signature Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <SignatureField fieldName="firstLightRepresentativeSignature" title="(FirstLight Home Care of Representative Signature)" />
                            <FormField control={form.control} name="firstLightRepresentativeTitle" render={({ field }) => ( <FormItem><FormLabel>(FirstLight Home Care of Rancho Cucamonga Representative Title)</FormLabel><FormControl><Input {...field} value={field.value || ''} disabled={isClientMode || isPublished} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="firstLightRepresentativeSignatureDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isClientMode || isPublished}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClientMode || isPublished} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                </div>

                <div className="space-y-6 break-before-page">
                    <h3 className="text-lg font-semibold text-center underline">TERMS AND CONDITIONS</h3>
                    <ol className="space-y-4 text-sm text-muted-foreground list-decimal list-inside">
                        {terms.map((term, index) => (
                            <li key={index}>
                                <strong>{term.title}</strong> {term.text}
                            </li>
                        ))}
                    </ol>
                </div>


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
