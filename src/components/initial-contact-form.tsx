

"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Save, FileText, AlertCircle, ExternalLink } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitInitialContact } from "@/lib/initial-contact.actions";
import { useDoc, useMemoFirebase, firestore } from "@/firebase";
import { doc, query, collection, where, getDocs } from 'firebase/firestore';
import { Checkbox } from "./ui/checkbox";
import { createCsaFromContact } from "@/lib/client-signup.actions";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";


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

const initialContactSchema = z.object({
  clientName: z.string().min(1, "Client's Name is required."),
  clientAddress: z.string().min(1, "Client's Address is required."),
  dateOfBirth: z.date().optional(),
  rateOffered: z.coerce.number().optional(),
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
  promptedCall: z.string().min(1, "This field is required."),
  estimatedHours: z.string().optional(),
  estimatedStartDate: z.date().optional(),
  inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
  inHomeVisitSetNoReason: z.string().optional(),
  medicalIns: z.string().optional(),
  dnr: z.boolean().optional(),
  va: z.string().optional(),
  hasPoa: z.enum(["Yes", "No"]).optional(),
  ltci: z.string().optional(),
  contactPhone: z.string().min(1, "Contact Phone is required."),
  languagePreference: z.string().optional(),
  additionalEmail: z.string().email("Please enter a valid email.").optional().or(z.literal('')),
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
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const contactDocRef = useMemoFirebase(() => contactId ? doc(firestore, 'initial_contacts', contactId) : null, [contactId]);
  const { data: existingData, isLoading } = useDoc<any>(contactDocRef);

  const isCsaCreated = !!signupDocId;

  useEffect(() => {
    const findSignupDoc = async () => {
      if (contactId) {
        const q = query(collection(firestore, 'client_signups'), where('initialContactId', '==', contactId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setSignupDocId(querySnapshot.docs[0].id);
        } else {
            setSignupDocId(null);
        }
      }
    };
    findSignupDoc();
  }, [contactId]);

  const form = useForm<InitialContactFormData>({
    resolver: zodResolver(initialContactSchema),
    defaultValues: {
      clientName: "",
      clientAddress: "",
      dateOfBirth: undefined,
      rateOffered: 0,
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
      promptedCall: "",
      estimatedHours: "",
      estimatedStartDate: undefined,
      inHomeVisitSet: undefined,
      inHomeVisitSetNoReason: "",
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
        form.reset(convertedData);
    }
  }, [existingData, form]);

  const onSubmit = (data: InitialContactFormData) => {
    startSubmittingTransition(async () => {
      setAuthUrl(null);
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

  const handleOpenCsa = async () => {
    let finalSignupId = signupDocId;

    if (!finalSignupId && contactId) {
        const result = await createCsaFromContact(contactId);
        if (result.error || !result.signupId) {
            toast({ title: "Error", description: result.error || "Could not create the Client Service Agreement document." });
            return;
        }
        finalSignupId = result.signupId;
        setSignupDocId(finalSignupId);
    }
    
    if (finalSignupId) {
        const url = pathname.includes('/admin')
            ? `/admin/new-client-signup?signupId=${finalSignupId}`
            : `/owner/new-client-signup?signupId=${finalSignupId}`;
        router.push(url);
    } else {
        toast({ title: "Error", description: "Cannot open Client Service Agreement without a saved Initial Contact." });
    }
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Left Column */}
              <div className="space-y-6">
                <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Client's Name</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
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
                                disabled={isCsaCreated}
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
                              disabled={isCsaCreated}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <FormField control={form.control} name="rateOffered" render={({ field }) => ( <FormItem><FormLabel>Rate Offered</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                <div className="flex gap-4">
                    <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Client's Phone Number</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Client's Email</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="mainContact" render={({ field }) => ( <FormItem><FormLabel>Main Contact</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="additionalEmail" render={({ field }) => ( <FormItem><FormLabel>Additional Email</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="allergies" render={({ field }) => ( <FormItem><FormLabel>Allergies</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="pets" render={({ field }) => ( <FormItem><FormLabel>Pets</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
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
                        <FormField control={form.control} name="timeOfVisit" render={({ field }) => ( <FormItem><FormLabel>Time of Visit</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
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
                        <FormField control={form.control} name="contactPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Phone:</FormLabel><FormControl><Input {...field} disabled={isCsaCreated} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="languagePreference" render={({ field }) => ( <FormItem><FormLabel>Language Preference:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </Card>
              </div>
            </div>
            
            <FormField control={form.control} name="promptedCall" render={({ field }) => ( <FormItem><FormLabel>What Prompted the Call In Today:</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem> )} />
            
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
                                disabled={isCsaCreated}
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
                          <Input {...field} disabled={isCsaCreated} />
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
                                disabled={isCsaCreated}
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
                          <Input {...field} disabled={isCsaCreated} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4" disabled={isCsaCreated}>
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

            <div className="flex justify-end pt-4 gap-4">
              {inHomeVisitSet === 'Yes' && (
                  <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenCsa}
                      disabled={!contactId || isSubmitting}
                  >
                      <FileText className="mr-2" />
                      Open Client Service Agreement
                  </Button>
              )}
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
