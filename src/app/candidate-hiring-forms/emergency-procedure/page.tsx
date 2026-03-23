
"use client";

import { useRef, useEffect, useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";
import { format } from "date-fns";
import Image from "next/image";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, CalendarIcon, Edit2 } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { emergencyProcedureSchema, type EmergencyProcedureFormData, type OnboardingSignatures } from "@/lib/types";
import { saveEmergencyProcedureData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const defaultFormValues: EmergencyProcedureFormData = {
  emergencyProcedureSignature: '',
  emergencyProcedureSignatureDate: undefined,
};

const safeToDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return undefined;
};

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

    useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
            if (signatureData) {
                sigPadRef.current.fromDataURL(signatureData);
            }
        }
    }, [isOpen, signatureData]);
    
    const handleClear = () => sigPadRef.current?.clear();
    
    const handleDone = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            onSave(sigPadRef.current.toDataURL());
        } else {
             onSave(""); 
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
                    />
                </div>
                <div className="flex justify-between p-4 border-t">
                    <Button type="button" variant="ghost" onClick={handleClear}><RefreshCw className="mr-2"/>Clear</Button>
                    <Button type="button" onClick={handleDone}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const emergencySections = [
    {
        title: "Priorities during an emergency:",
        points: [
            "Remain calm",
            "Call 911 if there is a true medical emergency",
            "Call the FLHC office immediately: (909)-321-4466. If you call twice, we will know it’s an emergency.",
            "Ensure client safety",
            "Follow directions from 911 dispatch or FLHC office",
            "Never move a client who has fallen unless you need to perform CPR.",
            "Stay with the client until help arrives and you have been relieved by another caregiver or emergency personnel.",
            "If the client is transported to the hospital, stay with the client if possible until family or FLHC arrives.",
            "Document the incident thoroughly."
        ]
    },
    {
        title: "FIRE:",
        points: [
            "Get the client out of the home immediately.",
            "Call 911, then FLHC.",
            "Do NOT try to put out the fire.",
            "Do NOT go back into the house for any reason."
        ]
    },
    {
        title: "FALL:",
        points: [
            "Do NOT try to lift the client.",
            "Call 911 if the client has hit their head, is unconscious, is bleeding, or is complaining of pain.",
            "Keep the client warm and comfortable.",
            "Call FLHC."
        ]
    },
    {
        title: "STROKE:",
        points: [
            "Call 911 immediately.",
            "Sudden weakness or numbness of the face, arm, or leg, especially on one side of the body.",
            "Sudden confusion, trouble speaking or understanding.",
            "Sudden trouble seeing in one or both eyes.",
            "Sudden trouble walking, dizziness, or loss of balance.",
            "Sudden, severe headache with no known cause."
        ]
    },
    {
        title: "HEART ATTACK:",
        points: [
            "Call 911 immediately.",
            "Uncomfortable pressure, squeezing, fullness or pain in the center of the chest.",
            "Pain that spreads to the shoulders, neck, or arms.",
            "Lightheadedness, fainting, sweating, nausea, or shortness of breath."
        ]
    },
    {
        title: "CHOKING:",
        points: [
            "If client can speak, cough or breathe, do NOT interfere.",
            "If client cannot speak, cough, or breathe, call 911 and perform the Heimlich Maneuver if you are trained."
        ]
    },
    {
        title: "NATURAL DISASTER (Earthquake, Flood, etc.):",
        points: [
            "Ensure your own safety and the client’s safety first.",
            "If an earthquake, 'Drop, Cover, and Hold On.'",
            "After the event, check the client for injuries.",
            "Contact FLHC as soon as it is safe to do so."
        ]
    }
];

export default function EmergencyProcedurePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof EmergencyProcedureFormData; title: string; } | null>(null);
    const firestore = useFirestore();

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const signatureDocRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, `caregiver_profiles/${profileIdToLoad}/signatures/onboarding_main`) : null),
      [profileIdToLoad, firestore]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<OnboardingSignatures>(signatureDocRef);
    
    const form = useForm<EmergencyProcedureFormData>({
      resolver: zodResolver(emergencyProcedureSchema),
      defaultValues: defaultFormValues,
    });
    
    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<EmergencyProcedureFormData> = {};
            const formSchemaKeys = Object.keys(emergencyProcedureSchema.shape) as Array<keyof EmergencyProcedureFormData>;
            
            formSchemaKeys.forEach(key => {
                if (Object.prototype.hasOwnProperty.call(existingData, key)) {
                    const value = (existingData as any)[key];
                    if (key.toLowerCase().includes('date') && value) {
                        (formData as any)[key] = safeToDate(value);
                    } else {
                        (formData as any)[key] = value;
                    }
                }
            });

            form.reset(formData);
        }
    }, [existingData, form]);

    const handleSaveSignature = (dataUrl: string) => {
        if (activeSignature) {
            form.setValue(activeSignature.fieldName, dataUrl, { shouldValidate: true, shouldDirty: true });
        }
    };

    const onSubmit = (data: EmergencyProcedureFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveEmergencyProcedureData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Emergency Procedures form has been saved."});
          if(isAnAdmin) {
            router.push(`/candidate-hiring-forms?candidateId=${profileIdToLoad}`);
          } else {
            router.push('/candidate-hiring-forms');
          }
        }
      });
    }

    const handleCancel = () => {
        if(isAnAdmin) {
            router.push(`/candidate-hiring-forms?candidateId=${profileIdToLoad}`);
        } else {
            router.push('/candidate-hiring-forms');
        }
    }

    const isLoading = isUserLoading || isDataLoading;

    if(isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className={cn("max-w-4xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader>
                <CardTitle className="text-2xl tracking-wide text-center">Caregiver Emergency Procedures</CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                {emergencySections.map(section => (
                    <div key={section.title}>
                        <h3 className="font-bold text-lg mb-2">{section.title}</h3>
                        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground pl-4">
                            {section.points.map((point, index) => <li key={index}>{point}</li>)}
                        </ul>
                    </div>
                ))}
                
                <div className="space-y-6 pt-6">
                    <p className="font-semibold">I have read and understand the FirstLight Home Care Emergency Procedures and agree to follow them to the best of my ability.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <FormLabel>Employee Signature</FormLabel>
                            <div className="relative rounded-md border bg-muted/30 h-28 flex items-center justify-center">
                                {form.watch('emergencyProcedureSignature') ? (
                                    <Image src={form.watch('emergencyProcedureSignature')!} alt="Signature" layout="fill" objectFit="contain" />
                                ) : (
                                    <span className="text-muted-foreground">Not Signed</span>
                                )}
                                {!isPrintMode && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-1 right-1 h-7 w-7"
                                        onClick={() => setActiveSignature({ fieldName: 'emergencyProcedureSignature', title: 'Employee Signature' })}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <FormMessage>{form.formState.errors.emergencyProcedureSignature?.message}</FormMessage>
                        </div>
                         <FormField control={form.control} name="emergencyProcedureSignatureDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>

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
            <CardFooter className={cn("flex justify-end gap-4", isPrintMode && "no-print")}>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                  Save Form
                </Button>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}
