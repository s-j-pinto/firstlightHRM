
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTransition } from 'react';
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { submitInitialContact } from '@/lib/initial-contact.actions';
import Image from 'next/image';

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstLight_Logo_VRT_CMYK_ICO.ico?alt=media&token=1151ccf8-5dc3-4ffd-b5aa-ca13e8b083d9";


const referralClientSchema = z.object({
  clientName: z.string().min(1, "Your Name is required."),
  clientAddress: z.string().min(1, "Your Address is required."),
  dateOfBirth: z.date().optional(),
  city: z.string().min(1, "City is required."),
  zip: z.string().min(1, "Zip code is required."),
  clientPhone: z.string().min(1, "Your Phone is required."),
  clientEmail: z.string().email("A valid email is required."),
  mainContact: z.string().min(1, "A main contact person is required."),
  allergies: z.string().optional(),
  pets: z.string().optional(),
  referredBy: z.string().optional(),
  referralCode: z.string().optional(),
  promptedCall: z.string().min(1, "Please let us know what prompted you to contact us."),
  estimatedHours: z.string().optional(),
  estimatedStartDate: z.date().optional(),
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
});

type ReferralClientFormData = z.infer<typeof referralClientSchema>;


const companionCareCheckboxes = [
    { id: 'companionCare_mealPreparation', label: 'Meal preparation and clean up' },
    { id: 'companionCare_cleanKitchen', label: 'Clean kitchen' },
    { id: 'companionCare_assistWithLaundry', label: 'Assist with laundry' },
    { id: 'companionCare_dustFurniture', label: 'Dust furniture' },
    { id: 'companionCare_assistWithEating', label: 'Assist with eating' },
    { id: 'companionCare_provideAlzheimersRedirection', label: "Alzheimer's redirection" },
    { id: 'companionCare_assistWithHomeManagement', label: 'Assist with home management' },
    { id: 'companionCare_preparationForBathing', label: 'Preparation for bathing' },
    { id: 'companionCare_groceryShopping', label: 'Grocery shopping' },
    { id: 'companionCare_cleanBathrooms', label: 'Clean bathrooms' },
    { id: 'companionCare_changeBedLinens', label: 'Change bed linens' },
    { id: 'companionCare_runErrands', label: 'Run errands' },
    { id: 'companionCare_escortAndTransportation', label: 'Escort and transportation' },
    { id: 'companionCare_provideRemindersAndAssistWithToileting', label: 'Toileting reminders' },
    { id: 'companionCare_provideRespiteCare', label: 'Provide respite care' },
    { id: 'companionCare_stimulateMentalAwareness', label: 'Stimulate mental awareness' },
    { id: 'companionCare_assistWithDressingAndGrooming', label: 'Dressing and grooming' },
    { id: 'companionCare_assistWithShavingAndOralCare', label: 'Shaving and oral care' },
];


function ReferralClientForm() {
  const [isSubmitting, startSubmittingTransition] = useTransition();
  const [isSubmitted, setIsSubmitted] = useTransition();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const form = useForm<ReferralClientFormData>({
    resolver: zodResolver(referralClientSchema),
    defaultValues: {
      clientName: "",
      clientAddress: "",
      city: "",
      zip: "",
      clientPhone: "",
      clientEmail: "",
      mainContact: "",
      contactPhone: "",
      allergies: "",
      pets: "",
      promptedCall: "Friend/Family Referral",
      estimatedHours: "",
      medicalIns: "",
      dnr: false,
      va: "",
      ltci: "",
      languagePreference: "",
      additionalEmail: "",
      companionCare_other: "",
      // Pre-populate from URL
      referralCode: searchParams.get('ref') || '',
      referredBy: searchParams.get('referrer') || '',
    },
  });

  const onSubmit = (data: ReferralClientFormData) => {
    startSubmittingTransition(async () => {
      const result = await submitInitialContact({
        contactId: null, // Always create a new one
        formData: {
          ...data,
          inHomeVisitSet: 'No', // This form doesn't set appointments
        }
      });

      if (result.error) {
        toast({
          title: "Submission Failed",
          description: result.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Request Received!",
          description: "Thank you for your interest. Our team will be in touch with you shortly.",
        });
        setIsSubmitted(() => form.reset());
      }
    });
  };
  
  if (isSubmitted) {
    return (
        <Card className="w-full max-w-2xl mx-auto my-8 text-center">
            <CardHeader>
                <div className="mx-auto bg-green-100 p-4 rounded-full w-fit mb-4">
                    <Image src={logoUrl} alt="FirstLight Home Care Logo" width={64} height={64} />
                </div>
                <CardTitle className="text-2xl font-bold font-headline">Thank You!</CardTitle>
                <CardDescription>Your care request has been submitted successfully. A member of our team will contact you soon to discuss the next steps.</CardDescription>
            </CardHeader>
        </Card>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto my-8">
        <CardHeader className="text-center">
            <Image src={logoUrl} alt="FirstLight Home Care Logo" width={80} height={80} className="mx-auto mb-4" />
            <CardTitle className="text-3xl font-bold font-headline">Request Care Information</CardTitle>
            <CardDescription>Thank you for your interest in FirstLight Home Care. Please fill out the form below and we will be in touch shortly.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-6">
                        <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Your Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="clientAddress" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem><FormLabel>Your Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem><FormLabel>Your Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="promptedCall" render={({ field }) => ( <FormItem><FormLabel>What prompted you to contact us?</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="referralCode" render={({ field }) => ( <FormItem><FormLabel>Referral Code</FormLabel><FormControl><Input {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="referredBy" render={({ field }) => ( <FormItem><FormLabel>Referred By</FormLabel><FormControl><Input {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                         <FormField
                            control={form.control}
                            name="estimatedStartDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Estimated Start Date</FormLabel>
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
                         <FormField control={form.control} name="estimatedHours" render={({ field }) => ( <FormItem><FormLabel>Estimated Hours per Week</FormLabel><FormControl><Input {...field} placeholder="e.g., 20 hours" /></FormControl><FormMessage /></FormItem> )} />
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="mainContact" render={({ field }) => ( <FormItem><FormLabel>Main Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="contactPhone" render={({ field }) => ( <FormItem><FormLabel>Main Contact Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                </div>
                 <div>
                  <FormLabel>What Companion Care services might you be interested in? (Select all that apply)</FormLabel>
                  <div className="p-4 border rounded-md mt-2 space-y-2 grid grid-cols-2 md:grid-cols-3">
                    {companionCareCheckboxes.map(item => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name={item.id as keyof ReferralClientFormData}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value as boolean}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end items-center pt-4 gap-4">
                    <Button type="submit" disabled={isSubmitting} size="lg">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Submit Care Request
                    </Button>
                </div>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}

export default function NewReferralClientPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>}>
            <ReferralClientForm />
        </Suspense>
    )
}
