
"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, usePathname } from "next/navigation";
import { format, differenceInYears } from "date-fns";
import { CalendarIcon, Loader2, Save, FileText, AlertCircle, ExternalLink, XCircle, Activity, Send, MessageSquare, Users, Sparkles, BrainCircuit } from "lucide-react";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitInitialContact, closeInitialContact, sendManualSms } from "@/lib/initial-contact.actions";
import { useDoc, useCollection, useMemoFirebase, firestore } from "@/firebase";
import { doc, query, collection, where, getDocs, orderBy } from 'firebase/firestore';
import { createCsaFromContact } from "@/lib/client-signup.actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "@/components/ui/label";
import { HelpDialog } from "./HelpDialog";
import { LevelOfCareForm } from "./level-of-care-form";
import { SourceCombobox } from "./source-combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SmsMessage } from "@/lib/types";
import { CaregiverRecommendationClient } from "./caregiver-recommendation-client";
import { AiCaregiverRecommendationClient } from "./ai-caregiver-recommendation-client";


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
];

const personalCareCheckboxes = [
    { id: 'personalCare_provideAlzheimersCare', label: "Provide Alzheimer's care, cognitive impairment" },
    { id: 'personalCare_provideMedicationReminders', label: 'Provide medication reminders' },
    { id: 'personalCare_assistWithDressingGrooming', label: 'Assist with dressing, grooming' },
    { id: 'personalCare_assistWithBathingHairCare', label: 'Assist with bathing, hair care' },
    { id: 'personalCare_assistWithFeedingSpecialDiets', label: 'Assist with feeding, special diets' },
    { id: 'personalCare_assistWithMobilityAmbulationTransfer', label: 'Assist with mobility, ambulation and transfer' },
    { id: 'personalCare_assistWithIncontinenceCare', label: 'Assist with incontinence care' },
] as const;

const closureReasons = [
    "Rates are too high",
    "Selected another Company",
    "Client is not in need of services anymore",
    "Google lead was incorrect",
    "Google lead was a Caregiver Applicant",
    "App referral was incorrect",
    "Other",
];

const initialContactSchema = z.object({
  clientName: z.string().min(1, "Client's Name is required."),
  source: z.string().min(1, "Source is required."),
  clientAddress: z.string().min(1, "Client's Address is required."),
  dateOfBirth: z.date().optional(),
  rateOffered: z.coerce.number().optional(),
  clientDepositAmount: z.coerce.number().optional(),
  city: z.string().min(1, "City is required."),
  zip: z.string().min(1, "Zip code is required."),
  clientPhone: z.string().min(1, "Client's Phone is required."),
  clientEmail: z.string().email("A valid email is required."),
  mainContact: z.string().min(1, "Main Contact is required."),
  allergies: z.string().optional(),
  pets: z.string().optional(),
  dateOfHomeVisit: z.date().optional(),
  timeOfVisit: z.string().optional(),
  referredBy: z.string().optional(),
  referralCode: z.string().optional(),
  promptedCall: z.string().min(1, "This field is required."),
  estimatedHours: z.string().optional(),
  estimatedStartDate: z.date().optional(),
  inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
  inHomeVisitSetNoReason: z.string().optional(),
  sendFollowUpCampaigns: z.boolean().optional(),
  medicalIns: z.string().optional(),
  dnr: z.boolean().optional(),
  va: z.string().optional(),
  hasPoa: z.enum(["Yes", "No"]).optional(),
  ltci: z.string().optional(),
  contactPhone: z.string().min(1, "Contact Phone is required."),
  languagePreference: z.string().optional(),
  additionalEmail: z.string().email("Please enter a valid email.").optional().or(z.literal('')),
  createdAt: z.any().optional(),
  createdBy: z.string().optional(),
  companionCare_mealPreparation: z.boolean().optional(),
    companionCare_cleanKitchen: z.boolean().optional(),
    companionCare_assistWithLaundry: z.boolean().optional(),
    companionCare_dustFurniture: z.boolean().optional(),
    companionCare_assistWithEating: z.boolean().optional(),
    companionCare_provideAlzheimersRedirection: z.boolean().optional(),
    companionCare_assistWithHomeManagement: z.boolean().optional(),
    companionCare_preparationForBathing: z.boolean().optional(),
    companionCare_groceryShopping: z.boolean().optional(),
    companionCare_cleanBathrooms: z.boolean().optional(),
    companionCare_changeBedLinens: z.boolean().optional(),
    companionCare_runErrands: z.boolean().optional(),
    companionCare_escortAndTransportation: z.boolean().optional(),
    companionCare_provideRemindersAndAssistWithToileting: z.boolean().optional(),
    companionCare_provideRespiteCare: z.boolean().optional(),
    companionCare_stimulateMentalAwareness: z.boolean().optional(),
    companionCare_assistWithDressingAndGrooming: z.boolean().optional(),
    companionCare_assistWithShavingAndOralCare: z.boolean().optional(),
    companionCare_other: z.string().optional(),
    personalCare_provideAlzheimersCare: z.boolean().optional(),
    personalCare_provideMedicationReminders: z.boolean().optional(),
    personalCare_assistWithDressingGrooming: z.boolean().optional(),
    personalCare_assistWithBathingHairCare: z.boolean().optional(),
    personalCare_assistWithFeedingSpecialDiets: z.boolean().optional(),
    personalCare_assistWithMobilityAmbulationTransfer: z.boolean().optional(),
    personalCare_assistWithIncontinenceCare: z.boolean().optional(),
    personalCare_assistWithOther: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.inHomeVisitSet === "Yes") {
        if (!data.dateOfHomeVisit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Date of Home Visit is required when a visit is set.",
                path: ["dateOfHomeVisit"],
            });
        }
        if (!data.timeOfVisit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Time of Visit is required when a visit is set.",
                path: ["timeOfVisit"],
            });
        }
    }
});

type InitialContactFormData = z.infer<typeof initialContactSchema>;

export function InitialContactForm({ contactId: initialContactId }: { contactId: string | null }) {
  const [isSubmitting, startSubmittingTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [contactId, setContactId] = useState(initialContactId);
  const [signupDocId, setSignupDocId] = useState<string | null>(null);
  const [locAssessmentId, setLocAssessmentId] = useState<string | null>(null);
  const [isLocDialogOpen, setIsLocDialogOpen] = useState(false);
  const [isRecsDialogOpen, setIsRecsDialogOpen] = useState(false);
  const [isAiRecsDialogOpen, setIsAiRecsDialogOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isClosureDialogOpen, setIsClosureDialogOpen] = useState(false);
  const [closureReason, setClosureReason] = useState("");
  const [isClosing, startClosingTransition] = useTransition();
  const [isSmsOpen, setIsSmsOpen] = useState(false);


  const contactDocRef = useMemoFirebase(() => contactId ? doc(firestore, 'initial_contacts', contactId) : null, [contactId]);
  const { data: existingData, isLoading } = useDoc<any>(contactDocRef);
  
  const smsHistoryQuery = useMemoFirebase(() => contactId ? query(collection(firestore, `initial_contacts/${contactId}/sms_history`), orderBy('timestamp', 'asc')) : null, [contactId]);
  const { data: smsHistory } = useCollection<SmsMessage>(smsHistoryQuery);

  const isCsaCreated = !!signupDocId;
  const isClosed = existingData?.status === 'Closed';
  const recommendationsPath = pathname.includes('/admin') ? '/admin/ai-recommendations' : '/owner/ai-recommendations';

  useEffect(() => {
    const findAssociatedDocs = async () => {
      if (contactId) {
        // Find signup doc
        const signupQuery = query(collection(firestore, 'client_signups'), where('initialContactId', '==', contactId));
        const signupSnapshot = await getDocs(signupQuery);
        if (!signupSnapshot.empty) {
          setSignupDocId(signupSnapshot.docs[0].id);
        } else {
          setSignupDocId(null);
        }
        // Find Level of Care doc
        const locQuery = query(collection(firestore, 'level_of_care_assessments'), where('initialContactId', '==', contactId));
        const locSnapshot = await getDocs(locQuery);
        if (!locSnapshot.empty) {
          setLocAssessmentId(locSnapshot.docs[0].id);
        } else {
          setLocAssessmentId(null);
        }
      }
    };
    findAssociatedDocs();
  }, [contactId]);

  const form = useForm<InitialContactFormData>({
    resolver: zodResolver(initialContactSchema),
    defaultValues: {
      clientName: "",
      source: "Phone Inquiry",
      clientAddress: "",
      dateOfBirth: undefined,
      rateOffered: 0,
      clientDepositAmount: 0,
      city: "",
      zip: "",
      clientPhone: "",
      clientEmail: "",
      mainContact: "",
      contactPhone: "",
      allergies: "",
      pets: "",
      dateOfHomeVisit: undefined,
      timeOfVisit: "",
      referredBy: "",
      referralCode: "",
      promptedCall: "",
      estimatedHours: "",
      estimatedStartDate: undefined,
      inHomeVisitSet: undefined,
      inHomeVisitSetNoReason: "",
      sendFollowUpCampaigns: true,
      medicalIns: "",
      dnr: false,
      va: "",
      hasPoa: undefined,
      ltci: "",
      languagePreference: "",
      additionalEmail: "",
      companionCare_other: "",
      personalCare_assistWithOther: "",
    },
  });
  
  useEffect(() => {
    if (existingData) {
        const dateFields = ['dateOfHomeVisit', 'estimatedStartDate', 'dateOfBirth'];
        const convertedData = { ...existingData };
        dateFields.forEach(field => {
            if (existingData[field] && typeof existingData[field].toDate === 'function') {
                convertedData[field] = existingData[field].toDate();
            }
        });
        if (convertedData.sendFollowUpCampaigns === undefined) {
            convertedData.sendFollowUpCampaigns = true; // Default to true if not set
        }
        form.reset(convertedData);
    }
  }, [existingData, form]);

  const onSubmit = (data: InitialContactFormData) => {
    startSubmittingTransition(async () => {
      setAuthUrl(null);
      
      const payload = {
        contactId: contactId,
        formData: data
      };

      if (data.inHomeVisitSet === "Yes") {
        payload.formData.sendFollowUpCampaigns = false; // Don't send campaigns if visit is set
      }

      const result = await submitInitialContact(payload);

      if (result.error) {
        toast({
          title: "Submission Failed",
          description: result.message,
          variant: "destructive",
        });
        if (result.authUrl) {
          setAuthUrl(result.authUrl);
        }
      } else {
        toast({
          title: "Success",
          description: result.message,
        });
        if (result.docId && !contactId) {
          setContactId(result.docId);
        }
      }
    });
  };

  const handleOpenCsa = async (type: 'private' | 'tpp') => {
    if (!contactId) {
        toast({
            title: "Save Required",
            description: "Please save the Initial Contact form before creating the Service Agreement.",
            variant: "destructive",
            duration: 7000
        });
        return;
    }
    
    let finalSignupId = signupDocId;

    if (!finalSignupId) {
        const result = await createCsaFromContact(contactId, type);
        if (result.error || !result.signupId) {
            toast({ title: "Error", description: result.error || "Could not create the Client Service Agreement document." });
            return;
        }
        finalSignupId = result.signupId;
        setSignupDocId(finalSignupId);
    }
    
    if (finalSignupId) {
        const isAdmin = pathname.includes('/admin');
        const url = type === 'tpp'
            ? (isAdmin ? `/admin/tpp-csa?signupId=${finalSignupId}` : `/owner/tpp-csa?signupId=${finalSignupId}`)
            : (isAdmin ? `/admin/new-client-signup?signupId=${finalSignupId}` : `/owner/new-client-signup?signupId=${finalSignupId}`);
        router.push(url);
    } else {
        toast({ title: "Error", description: "Cannot open Client Service Agreement without a saved Initial Contact." });
    }
  };

  const handleCloseContact = () => {
    if (!contactId) {
      toast({ title: "Error", description: "You must save the contact before you can close it.", variant: "destructive" });
      return;
    }
    if (!closureReason) {
        toast({ title: "Reason Required", description: "Please select a reason for closing the contact.", variant: "destructive"});
        return;
    }
    startClosingTransition(async () => {
        const result = await closeInitialContact(contactId, closureReason);
        if (result.error) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
            setIsClosureDialogOpen(false);
            const dashboardPath = pathname.includes('/admin') ? '/admin/assessments' : '/owner/dashboard';
            router.push(dashboardPath);
        }
    });
  };


  const inHomeVisitSet = form.watch("inHomeVisitSet");
  const dateOfBirth = form.watch("dateOfBirth");
  const age = dateOfBirth ? differenceInYears(new Date(), dateOfBirth) : null;
  const isAutomatedSource = existingData && existingData.source && !['Phone Inquiry', 'Walk-In', 'Existing Client'].includes(existingData.source);


  if(isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent"/></div>
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <div className="flex justify-end -mb-4">
                <Button type="button" variant="outline" size="icon" className="mr-2" onClick={() => setIsSmsOpen(true)} disabled={!contactId || isClosed}><MessageSquare/></Button>
                <HelpDialog topic="initialContact" />
            </div>

            {authUrl && (
                <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Action Required: Authorize Google Calendar</AlertTitle>
                <AlertDescription>
                    <p className="mb-2">
                    To send calendar invites, you must grant permission. Click the button below to authorize.
                    </p>
                    <Button asChild>
                        <a href={authUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Authorization Page
                        </a>
                    </Button>
                </AlertDescription>
                </Alert>
            )}
            
            {isClosed && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>This Contact is Closed</AlertTitle>
                    <AlertDescription>
                        Reason: <strong>{existingData?.closureReason}</strong>. All fields are read-only.
                    </AlertDescription>
                </Alert>
            )}

             {isCsaCreated && (
                 <Alert variant="default" className="bg-blue-50 border-blue-200">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">CSA Active</AlertTitle>
                    <AlertDescription className="text-blue-700">
                        A Client Service Agreement has been created for this contact. Some fields below are now read-only. To edit this information, please open the CSA.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client&apos;s Name</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField
                        control={form.control}
                        name="source"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Source</FormLabel>
                                {isAutomatedSource ? (
                                    <Input value={field.value} readOnly disabled className="bg-muted" />
                                ) : (
                                    <SourceCombobox
                                        value={field.value}
                                        onChange={(value) => field.onChange(value)}
                                        disabled={isClosed}
                                    />
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <div className="grid grid-cols-2 gap-4 items-end">
                    <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date of Birth</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                    disabled={isCsaCreated || isClosed}
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
                                captionLayout="dropdown-buttons"
                                fromYear={1920}
                                toYear={new Date().getFullYear()}
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                disabled={isCsaCreated || isClosed}
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                            <Input value={age !== null ? age : ''} readOnly disabled className="bg-muted" />
                        </FormControl>
                    </FormItem>
                </div>
                <FormField control={form.control} name="rateOffered" render={({ field }) => ( <FormItem><FormLabel>Rate Offered</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                <div className="flex gap-4">
                    <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Client&apos;s Phone Number</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Client&apos;s Email</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="mainContact" render={({ field }) => ( <FormItem><FormLabel>Main Contact</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="additionalEmail" render={({ field }) => ( <FormItem><FormLabel>Additional Email</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="allergies" render={({ field }) => ( <FormItem><FormLabel>Allergies</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="pets" render={({ field }) => ( <FormItem><FormLabel>Pets</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                </div>
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
                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isClosed}>
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClosed} />
                                    </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="timeOfVisit" render={({ field }) => ( <FormItem><FormLabel>Time of Visit</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="referredBy" render={({ field }) => ( <FormItem><FormLabel>Referred By</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="referralCode" render={({ field }) => ( <FormItem><FormLabel>Referral Code</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                        <FormField control={form.control} name="medicalIns" render={({ field }) => ( <FormItem><FormLabel>Medical Ins</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="dnr" render={({ field }) => ( <FormItem className="flex items-center gap-2 pt-8"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isClosed} /></FormControl><FormLabel className="!mt-0">DNR</FormLabel><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="va" render={({ field }) => ( <FormItem><FormLabel>VA</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="hasPoa" render={({ field }) => ( <FormItem><FormLabel>Has POA</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4" disabled={isClosed}><FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="Yes"/></FormControl><FormLabel className="font-normal">Y</FormLabel></FormItem><FormItem className="flex items-center space-x-1 space-y-0"><FormControl><RadioGroupItem value="No"/></FormControl><FormLabel className="font-normal">N</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="ltci" render={({ field }) => ( <FormItem><FormLabel>LTCI</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="contactPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Phone:</FormLabel><FormControl><Input {...field} disabled={isCsaCreated || isClosed} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="languagePreference" render={({ field }) => ( <FormItem><FormLabel>Language Preference:</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </Card>
              </div>
            </div>
            
            <FormField control={form.control} name="promptedCall" render={({ field }) => ( <FormItem><FormLabel>What Prompted the Call In Today:</FormLabel><FormControl><Textarea {...field} rows={4} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div>
                  <FormLabel>COMPANION CARE</FormLabel>
                  <div className="p-4 border rounded-md mt-2 space-y-2 grid grid-cols-2">
                    {companionCareCheckboxes.map(item => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name={item.id as keyof InitialContactFormData}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value as boolean}
                                onCheckedChange={field.onChange}
                                disabled={isCsaCreated || isClosed}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormField
                    control={form.control}
                    name="companionCare_other"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Other Companion Care Needs</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isCsaCreated || isClosed} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormLabel>PERSONAL CARE</FormLabel>
                  <div className="p-4 border rounded-md mt-2 space-y-2 grid grid-cols-1">
                    {personalCareCheckboxes.map(item => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name={item.id as keyof InitialContactFormData}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value as boolean}
                                onCheckedChange={field.onChange}
                                disabled={isCsaCreated || isClosed}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                   <FormField
                    control={form.control}
                    name="personalCare_assistWithOther"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Assist with other</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isCsaCreated || isClosed} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                 <div className="space-y-6">
                    <FormField control={form.control} name="estimatedHours" render={({ field }) => ( <FormItem><FormLabel>Estimated Hours:</FormLabel><FormControl><Input {...field} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="clientDepositAmount" render={({ field }) => ( <FormItem><FormLabel>Client Deposit Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} disabled={isClosed} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField
                        control={form.control}
                        name="estimatedStartDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Estimated Start Date:</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isClosed}>
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isClosed} />
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
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4" disabled={isClosed}>
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes"/></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No"/></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {inHomeVisitSet === 'No' && (
                        <div className="space-y-4 rounded-md border p-4">
                            <FormField
                                control={form.control}
                                name="inHomeVisitSetNoReason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>If NO, Why?</FormLabel>
                                        <FormControl><Textarea {...field} disabled={isClosed} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sendFollowUpCampaigns"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                    <FormLabel>Send Automatic 3, 7, and 14 day reminders?</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={(val) => field.onChange(val === 'true')}
                                        value={String(field.value)}
                                        className="flex items-center gap-4"
                                        disabled={isClosed}
                                        >
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="true" /></FormControl>
                                            <FormLabel className="font-normal">Yes</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="false" /></FormControl>
                                            <FormLabel className="font-normal">No</FormLabel>
                                        </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end items-center pt-4 gap-4">
                <p className="text-sm text-destructive mr-auto">Please click &apos;Save Initial Contact&apos; to save any changes on this page.</p>

                {contactId && !isClosed && (
                    <Dialog open={isClosureDialogOpen} onOpenChange={setIsClosureDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="destructive">
                                <XCircle className="mr-2" /> Close Contact
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Close Initial Contact</DialogTitle>
                                <DialogDescription>
                                    Select a reason for closing this contact. This will mark the contact as closed and archive any associated Client Service Agreement. This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="closure-reason">Closure Reason</Label>
                                <Select onValueChange={setClosureReason} value={closureReason}>
                                    <SelectTrigger id="closure-reason">
                                        <SelectValue placeholder="Select a reason..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {closureReasons.map(reason => (
                                            <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsClosureDialogOpen(false)}>Cancel</Button>
                                <Button type="button" variant="destructive" onClick={handleCloseContact} disabled={isClosing || !closureReason}>
                                    {isClosing && <Loader2 className="mr-2 animate-spin" />}
                                    Confirm Closure
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
                
                 {contactId && (
                     <Button asChild type="button" variant="outline" disabled={isClosed}>
                        <Link href={`${recommendationsPath}?contactId=${contactId}`}>
                            <Sparkles className="mr-2" /> Gemini Recommended Caregivers
                        </Link>
                    </Button>
                )}
                
                {contactId && (
                  <Dialog open={isRecsDialogOpen} onOpenChange={setIsRecsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" disabled={isClosed}>
                          <BrainCircuit className="mr-2" /> Recommended Caregivers
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Rules-Based Caregiver Recommendations</DialogTitle>
                        </DialogHeader>
                        <CaregiverRecommendationClient contactId={contactId} />
                    </DialogContent>
                  </Dialog>
                )}
                
                {contactId && (
                  <Dialog open={isLocDialogOpen} onOpenChange={setIsLocDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" disabled={isClosed}>
                          <Activity className="mr-2" /> Level Of Care
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Level of Care Assessment</DialogTitle>
                        </DialogHeader>
                        <LevelOfCareForm
                            initialContactId={contactId}
                            assessmentId={locAssessmentId}
                            onSave={() => {
                                setIsLocDialogOpen(false);
                            }}
                        />
                    </DialogContent>
                  </Dialog>
                )}

                {contactId && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenCsa('private')}
                        disabled={isSubmitting || isClosed}
                    >
                        <FileText className="mr-2" />
                        {isCsaCreated ? 'Open Private Pay CSA' : 'Create Private Pay CSA'}
                    </Button>
                )}

                {contactId && (
                     <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenCsa('tpp')}
                        disabled={isSubmitting || isClosed}
                    >
                        <FileText className="mr-2" />
                        Create Third Party Payor CSA
                    </Button>
                )}

                <Button type="submit" disabled={isSubmitting || isClosed}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Initial Contact
                </Button>
            </div>
          </form>
        </Form>

        <Dialog open={isSmsOpen} onOpenChange={setIsSmsOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>SMS History with {existingData?.clientName}</DialogTitle>
                    <DialogDescription>
                        View messages and send a reply.
                    </DialogDescription>
                </DialogHeader>
                <SmsChatInterface contactId={contactId} />
            </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}

function SmsChatInterface({ contactId }: { contactId: string | null }) {
    const [newMessage, setNewMessage] = useState('');
    const [isSending, startSendingTransition] = useTransition();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const smsHistoryQuery = useMemoFirebase(() => 
        contactId ? query(collection(firestore, `initial_contacts/${contactId}/sms_history`), orderBy('timestamp', 'asc')) : null, 
        [contactId]
    );
    const { data: smsHistory, isLoading } = useCollection<SmsMessage>(smsHistoryQuery);
    
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [smsHistory]);

    const handleSend = () => {
        if (!contactId || !newMessage.trim()) return;

        startSendingTransition(async () => {
            const result = await sendManualSms(contactId, newMessage);
            if (result.error) {
                toast({ title: 'Error Sending SMS', description: result.error, variant: 'destructive' });
            } else {
                setNewMessage('');
            }
        });
    };

    return (
        <div className="flex flex-col h-[60vh]">
            <ScrollArea className="flex-1 p-4 border rounded-md" ref={scrollAreaRef}>
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="animate-spin" />
                    </div>
                ) : smsHistory && smsHistory.length > 0 ? (
                    <div className="space-y-4">
                        {smsHistory.map(msg => (
                            <div key={msg.id} className={cn("flex", msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                                <div className={cn("max-w-xs p-3 rounded-lg", msg.direction === 'outbound' ? 'bg-accent text-accent-foreground' : 'bg-muted')}>
                                    <p className="text-sm">{msg.text}</p>
                                    <p className="text-xs text-right mt-1 opacity-70">
                                        {msg.timestamp ? format((msg.timestamp as any).toDate(), 'PPp') : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">No SMS history for this contact.</p>
                    </div>
                )}
            </ScrollArea>
            <div className="mt-4 flex gap-2">
                <Textarea 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Type your message..."
                    rows={2}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                <Button onClick={handleSend} disabled={isSending || !newMessage.trim()}>
                    {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
            </div>
        </div>
    )
}
