
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
import { useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { telephonyInstructionsSchema, type TelephonyInstructionsFormData, type CaregiverProfile, type CaregiverEmployee } from "@/lib/types";
import { saveTelephonyInstructionsData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/TeleTrackLogo.png?alt=media&token=bb364313-385d-46da-9252-87074edda322";

const defaultFormValues: TelephonyInstructionsFormData = {
  telephonyEmployeeSignature: '',
  telephonyEmployeeSignatureDate: undefined,
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
                 if (signatureData.startsWith('data:image/png')) {
                    sigPadRef.current.fromDataURL(signatureData);
                }
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
                        canvasProps={{ className: 'w-full h-full rounded-md', style: {backgroundColor: 'white'} }}
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

export default function CaregiverTelephonyInstructionsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof TelephonyInstructionsFormData; title: string; } | null>(null);
    const firestore = useFirestore();

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const caregiverProfileRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
      [profileIdToLoad, firestore]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const employeeRecordRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_employees', profileIdToLoad) : null),
      [profileIdToLoad, firestore]
    );
    const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<CaregiverEmployee>(employeeRecordRef);

    const form = useForm<TelephonyInstructionsFormData>({
      resolver: zodResolver(telephonyInstructionsSchema),
      defaultValues: defaultFormValues,
    });
    
    const SignatureField = ({ fieldName, title }: { fieldName: keyof TelephonyInstructionsFormData; title: string; }) => {
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
            const formData:Partial<TelephonyInstructionsFormData> = {};
            const formSchemaKeys = Object.keys(telephonyInstructionsSchema.shape) as Array<keyof TelephonyInstructionsFormData>;
            
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

    const onSubmit = (data: TelephonyInstructionsFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveTelephonyInstructionsData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Telephony Instructions form has been acknowledged."});
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

    const isLoading = isUserLoading || isDataLoading || isEmployeeLoading;

    if(isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className={cn("max-w-2xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader>
                <div className="flex items-start gap-4">
                    <Image src={logoUrl} alt="TeleTrack Logo" width={60} height={60} className="object-contain" />
                    <CardTitle className="text-xl tracking-wide pt-4">TeleTrack Telephony Instructions</CardTitle>
                </div>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <ul className="list-disc list-inside space-y-4 text-sm text-muted-foreground">
                    <li><strong>Step 1</strong> From the Clients Telephone call the Clock In number. <strong>866-425-8463</strong></li>
                    <li><strong>Step 2</strong> Input your 4-digit TeleTrack ID Number <strong className="font-mono bg-muted px-2 py-1 rounded">{employeeData?.teletrackPin || '____'}</strong> (provided by your oﬃce)</li>
                    <li><strong>Step 3</strong> Input your work status:
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Press <strong>1</strong>, for arrival and then hang up</li>
                            <li>Press <strong>2</strong>, for departure and then go to Step 4</li>
                        </ul>
                    </li>
                    <li><strong>Step 4</strong> Entering Activity Codes – Only prompted when departing. <strong>N/A</strong> To enter Activity Codes enter the 3-digit code associated with the task you completed and press #, the system will prompt you to enter your next Activity Code. When you have entered all Activity Codes for task completed during this visit press * then #. This will give you confirmation of a successful departure.
                        <p className="mt-2">Activity Codes (provided by your oﬃce)</p>
                        <div className="border-t border-dashed border-muted-foreground my-4 h-[250px]"></div>
                    </li>
                </ul>
                <div className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                       <div className="space-y-2">
                            <FormLabel>Employee's Name</FormLabel>
                            <Input value={existingData?.fullName || ''} readOnly disabled />
                       </div>
                        <SignatureField fieldName="telephonyEmployeeSignature" title="Employee Signature" />
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
                  Acknowledge and Save
                </Button>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}

    