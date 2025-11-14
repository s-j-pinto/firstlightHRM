
'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
    Loader2,
    Calendar as CalendarIcon,
    ArrowRight,
    Save,
    Clock,
    Calendar,
    CheckCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { submitLeadIntakeForm } from "@/lib/lead-intake.actions";
import { AppointmentScheduler } from './appointment-scheduler'; // We will use a simplified version for this

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

const leadIntakeSchema = z.object({
  // Pre-populated and read-only
  clientName: z.string(),
  clientEmail: z.string(),
  clientPhone: z.string(),
  
  // Editable fields
  estimatedStartDate: z.date().optional(),
  estimatedHours: z.string().optional(),
  
  // Companion Care Checkboxes
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

  // Appointment time
  assessmentTime: z.string().min(1, "Please select an appointment time."),
});

type LeadIntakeFormData = z.infer<typeof leadIntakeSchema>;

interface LeadIntakeFormProps {
    contactId: string;
    initialData: any;
}

export function LeadIntakeForm({ contactId, initialData }: LeadIntakeFormProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, startSubmittingTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<LeadIntakeFormData>({
        resolver: zodResolver(leadIntakeSchema),
        defaultValues: {
            clientName: initialData.clientName || '',
            clientEmail: initialData.clientEmail || '',
            clientPhone: initialData.clientPhone || '',
            estimatedStartDate: initialData.estimatedStartDate?.toDate() || undefined,
            estimatedHours: initialData.estimatedHours || '',
            assessmentTime: '',
            ...Object.fromEntries(companionCareCheckboxes.map(item => [item.id, initialData[item.id] || false]))
        }
    });

    const handleNextStep = async () => {
        const fieldsToValidate: (keyof LeadIntakeFormData)[] = [
            'estimatedStartDate', 'estimatedHours', ...companionCareCheckboxes.map(c => c.id as keyof LeadIntakeFormData)
        ];
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setCurrentStep(2);
        } else {
            toast({
                title: "Incomplete Information",
                description: "Please fill out the service details before proceeding.",
                variant: "destructive"
            });
        }
    };
    
    const onSubmit = (data: LeadIntakeFormData) => {
        startSubmittingTransition(async () => {
            const result = await submitLeadIntakeForm(contactId, data);

            if (result.error) {
                toast({
                    title: "Submission Failed",
                    description: result.message,
                    variant: "destructive",
                });
            } else {
                router.push(`/confirmation?time=${data.assessmentTime}`);
            }
        });
    };

    return (
        <Card className="w-full max-w-4xl mx-auto my-8 shadow-lg">
             <CardHeader>
                <CardTitle className="text-3xl font-bold text-center font-headline">
                  {currentStep === 1 ? 'Confirm Your Care Needs' : 'Schedule Your In-Home Assessment'}
                </CardTitle>
                <CardDescription className="text-center">
                  {currentStep === 1 
                    ? 'Please review the information below and tell us more about your needs.'
                    : 'Select a convenient time for our care coordinator to visit you at home.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {currentStep === 1 && (
                            <>
                                <div className="p-4 border rounded-md bg-muted/50 space-y-4">
                                     <h3 className="text-lg font-semibold">Your Information</h3>
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                         <FormField control={form.control} name="clientName" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} readOnly className="bg-background" /></FormControl></FormItem> )} />
                                         <FormField control={form.control} name="clientEmail" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} readOnly className="bg-background" /></FormControl></FormItem> )} />
                                         <FormField control={form.control} name="clientPhone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} readOnly className="bg-background" /></FormControl></FormItem> )} />
                                     </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Service Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <FormLabel className="text-base font-semibold">What Companion Care services are you interested in?</FormLabel>
                                    <div className="p-4 border rounded-md mt-2 space-y-2 grid grid-cols-2 md:grid-cols-3">
                                        {companionCareCheckboxes.map(item => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name={item.id as keyof LeadIntakeFormData}
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
                                <div className="flex justify-end pt-4">
                                     <Button type="button" onClick={handleNextStep}>
                                        Next: Schedule Assessment <ArrowRight className="ml-2" />
                                    </Button>
                                </div>
                            </>
                        )}
                        
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="assessmentTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <AppointmentScheduler
                                                    caregiverId={contactId}
                                                    onSlotSelect={(slot) => field.onChange(slot)}
                                                    selectedSlot={field.value}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <div className="flex justify-between pt-4">
                                    <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                                        Back
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                        Confirm and Submit
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
