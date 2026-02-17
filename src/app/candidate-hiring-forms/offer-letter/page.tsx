
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
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { offerLetterSchema, type OfferLetterFormData, type CaregiverProfile } from "@/lib/types";
import { saveOfferLetterData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

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
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0">
                <DialogHeader className="p-4 border-b"><DialogTitle>{title}</DialogTitle></DialogHeader>
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

interface HiringFields {
    caregiver_rate_trng_orient?: number;
    minimum_client_care_pay_rate?: number;
}

export default function OfferLetterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof OfferLetterFormData; title: string } | null>(null);

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const caregiverProfileRef = useMemoFirebase(() => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null), [profileIdToLoad]);
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const settingsRef = useMemoFirebase(() => doc(firestore, 'settings', 'hiring_form_fields'), []);
    const { data: settingsData, isLoading: isSettingsLoading } = useDoc<HiringFields>(settingsRef);
    
    const form = useForm<OfferLetterFormData>({
        resolver: zodResolver(offerLetterSchema),
        defaultValues: { offerLetterSignature: '', offerLetterSignatureDate: undefined },
    });

    useEffect(() => {
        if (existingData) {
            const formData: Partial<OfferLetterFormData> = {};
            if(existingData.offerLetterSignature) formData.offerLetterSignature = existingData.offerLetterSignature;
            if(existingData.offerLetterSignatureDate) formData.offerLetterSignatureDate = safeToDate(existingData.offerLetterSignatureDate);
            if(existingData.hireDate) formData.hireDate = safeToDate(existingData.hireDate);
            form.reset(formData);
        }
    }, [existingData, form]);

    const handleSaveSignature = (dataUrl: string) => {
        if (activeSignature) {
            form.setValue(activeSignature.fieldName, dataUrl, { shouldValidate: true, shouldDirty: true });
        }
    };

    const onSubmit = (data: OfferLetterFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveOfferLetterData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Offer Letter has been saved."});
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

    const isLoading = isUserLoading || isDataLoading || isSettingsLoading;

    if(isLoading) {
      return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>;
    }

    const rateTrngOrient = settingsData?.caregiver_rate_trng_orient || '16.00';
    const minPayRate = settingsData?.minimum_client_care_pay_rate || '18.00';
    
    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <Image src={logoUrl} alt="FirstLight Home Care Logo" width={250} height={50} className="object-contain" />
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <p>Dear {existingData?.fullName},</p>
                        
                        <div className="space-y-4 text-sm text-muted-foreground">
                            <p>We are pleased to confirm our offer to join FirstLight Home Care as Home Care Aide. The information below confirms the details of our previous discussions.</p>
                            <p>Your caregiver rate will be as follows:<br/>Training/Orientation - ${rateTrngOrient}.<br/>Your client visit hourly rate will be determined by the services provided to a client and may be adjusted periodically based upon your performance at FirstLight HomeCare. The minimum client care pay rate is ${minPayRate}. Based on the client care duties, you may be eligible for a higher pay rate. You will be eligible to receive overtime pay if you work more than 9 hours a day and/or 45 hours a week.</p>
                            <p>We have Workers’ Compensation available for our employees in case of injury at work. The carrier is Benchmark. Sick days are accumulated up to a maximum of 40 hours a year.</p>
                            <div className="flex items-center flex-wrap">
                                <p className="mr-2">We look forward to you joining us on</p>
                                <FormField
                                    control={form.control}
                                    name="hireDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={!isAnAdmin}>
                                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={!isAnAdmin} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <p>On your first day with FirstLight Home Care, you will need to demonstrate your eligibility to work in the United States by providing the documentation required by INS form I-9. A summary of these requirements is enclosed.</p>
                            <p>This offer of employment is contingent upon FirstLight’s satisfactory verification of the qualifications, documents submitted, and background [HCA registration and live scan fingerprints] presented in your resume and application, in the course of our conversations, and in correspondence with FirstLight. The offer is also contingent upon demonstrating a drug-free lifestyle through the completion of a company drug screening and the satisfactory completion of a background check, which includes a review of criminal history.</p>
                            <p>While we hope you accept this offer, nothing in this letter should be interpreted as creating an employment contract for a definite period of time. All employees of FirstLight are employed at-will, and either you or FirstLight may terminate your employment at any time, for any reason, with or without cause.</p>
                            <p>I am excited about the background and potential you bring to FirstLight and hope you view this offer as an indication of our confidence in your long-term success with us.</p>
                            <p>Please acknowledge your acceptance of this offer by returning a signed copy of this letter and the Confidentiality agreement by fax or email.</p>
                        </div>
                        
                        <div className="space-y-2">
                          <p>Sincerely,</p>
                          <p>Lolita Pinto / Jacqui Wilson</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end pt-8">
                             <div className="space-y-2">
                                <FormField
                                    control={form.control}
                                    name="offerLetterSignature"
                                    render={() => (
                                        <div className="space-y-2">
                                            <FormLabel>Accepted:</FormLabel>
                                            <div className="relative rounded-md border bg-muted/30 h-28 flex items-center justify-center">
                                                {form.getValues('offerLetterSignature') ? ( <Image src={form.getValues('offerLetterSignature')!} alt="Signature" layout="fill" objectFit="contain" /> ) : ( <span className="text-muted-foreground">Not Signed</span> )}
                                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setActiveSignature({ fieldName: 'offerLetterSignature', title: 'Acceptance Signature' })}><Edit2 className="h-4 w-4" /></Button>
                                            </div>
                                            <FormMessage>{form.formState.errors.offerLetterSignature?.message}</FormMessage>
                                        </div>
                                    )}
                                />
                             </div>
                            <FormField control={form.control} name="offerLetterSignatureDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                         <div className="pt-2"><p>Phone Number: {existingData?.phone}</p></div>

                    </CardContent>
                    <CardFooter className="flex flex-col items-center gap-4">
                        <div className="flex w-full justify-end gap-4">
                            <Button type="button" variant="outline" onClick={handleCancel}><X className="mr-2" />Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}Save Form</Button>
                        </div>
                        <p className="text-xs text-muted-foreground pt-8 text-center">FirstLight home Care of Rancho Cucamonga<br/>9650 Business Center Drive, Suite 132 Rancho Cucamonga, CA 91730<br/>Phone: 909-321-4466 Fax: 909-694-2474</p>
                    </CardFooter>
                </form>
            </Form>
             {activeSignature && (
                <SignaturePadModal
                    isOpen={!!activeSignature}
                    onClose={() => setActiveSignature(null)}
                    onSave={handleSaveSignature}
                    signatureData={form.getValues(activeSignature.fieldName)}
                    title={activeSignature.title}
                />
            )}
        </Card>
    );
}
