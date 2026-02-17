
"use client";

import { useRef, useEffect, useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";
import { format } from "date-fns";
import Image from "next/image";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, CalendarIcon, Edit2 } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { acknowledgmentFormSchema, type AcknowledgmentFormData, type CaregiverProfile } from "@/lib/types";
import { saveAcknowledgmentFormData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";


const defaultFormValues: AcknowledgmentFormData = {
  acknowledgmentEmployeeName: '',
  acknowledgmentSignature: '',
  acknowledgmentSignatureDate: undefined,
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
    const [isSigned, setIsSigned] = useState(false);

    useEffect(() => {
        if (isOpen && sigPadRef.current) {
            sigPadRef.current.clear();
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

export default function AcknowledgmentFormPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof AcknowledgmentFormData; title: string; } | null>(null);

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const caregiverProfileRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
      [profileIdToLoad]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);
    
    const form = useForm<AcknowledgmentFormData>({
      resolver: zodResolver(acknowledgmentFormSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (existingData?.fullName && !form.getValues('acknowledgmentEmployeeName')) {
            form.setValue('acknowledgmentEmployeeName', existingData.fullName);
        }
    }, [existingData, form]);
    
    const SignatureField = ({ fieldName, title }: { fieldName: keyof AcknowledgmentFormData; title: string; }) => {
        const signatureData = form.watch(fieldName);
        const disabled = isPrintMode;
        
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

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<AcknowledgmentFormData> = {};
            const formSchemaKeys = Object.keys(acknowledgmentFormSchema.shape) as Array<keyof AcknowledgmentFormData>;
            
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

    const onSubmit = (data: AcknowledgmentFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveAcknowledgmentFormData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Acknowledgment Form has been saved."});
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
                <Image src={logoUrl} alt="FirstLight Home Care Logo" width={250} height={50} className="object-contain" />
                <CardTitle className="text-xl tracking-wide pt-4">
                    ACKNOWLEDGMENT FORM
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <div className="space-y-4 text-sm text-muted-foreground">
                   <p>This Employee Manual has been prepared for your understanding of the policies, practices, and benefits of FirstLight Home Care; it is important to read this entire Manual. We reserve the right to make changes at any time without notice and to interpret these policies and procedures at the discretion of FirstLight Home Care. This Employee Manual supersedes all prior manuals and previously issued policies.</p>
                   <p>After you finish reading this Employee Manual, please sign, date, and return this Acknowledgement Form within seven (7) days of your receiving this Employee Manual to read.</p>
                   <p>You agree to keep this Manual in your possession during your employment and to update it whenever new information is provided to you. You acknowledge that this Manual remains the property of FirstLight Home Care and must be returned immediately upon request, or upon the termination of your employment.</p>
                   <p>By signing below, you acknowledge that you have read and understood the policies outlined in this Employee Manual. You agree to comply with the policies contained in this Manual and to read and understand any revisions to it and be bound by them. You understand this Manual is intended only as a general reference and is not intended to cover every situation that may arise during your employment. This Manual is not a full statement of company policy. Any questions regarding this Manual can be discussed with your supervisor, Care Coordinator or FirstLight Home Care management.</p>
                   <p>You acknowledge that this Manual is not intended to create, nor shall be construed as creating, any express or implied contract of employment for a definite or specific period of time between you and FirstLight Home Care or to otherwise create express or implied legally enforceable contractual obligations on the part of FirstLight Home Care concerning any terms, conditions, or privileges of employment.</p>
                </div>

                <div className="space-y-6 pt-6">
                     <FormField control={form.control} name="acknowledgmentEmployeeName" render={({ field }) => (
                        <FormItem><FormLabel>Employee name (print legibly)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <SignatureField fieldName="acknowledgmentSignature" title="Employee signature" />
                        <FormField control={form.control} name="acknowledgmentSignatureDate" render={({ field }) => (
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
            <CardFooter className="flex-col items-center gap-4">
                 <div className={cn("flex w-full justify-end gap-4", isPrintMode && "no-print")}>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                    <X className="mr-2" />
                    Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Save Form
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground pt-8 text-center">
                    9650 Business Center Drive, Suite 132 | Rancho Cucamonga, CA 91730 | Phone 909-321-4466 | Fax <a href="http://ranchocucamonga.firstlighthomecare.com" className="underline">http://ranchocucamonga.firstlighthomecare.com</a> | License # 364700059 Fax 909-694-2474
                </p>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}

