
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
import { employeeOrientationAgreementSchema, type EmployeeOrientationAgreementFormData, type CaregiverProfile } from "@/lib/types";
import { saveEmployeeOrientationAgreementData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

const defaultFormValues: EmployeeOrientationAgreementFormData = {
  orientationAgreementEmployeeName: '',
  orientationAgreementSignature: '',
  orientationAgreementSignatureDate: undefined,
  orientationAgreementWitnessSignature: '',
  orientationAgreementWitnessDate: undefined,
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

export default function EmployeeOrientationAgreementPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof EmployeeOrientationAgreementFormData; title: string; } | null>(null);

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
    
    const form = useForm<EmployeeOrientationAgreementFormData>({
      resolver: zodResolver(employeeOrientationAgreementSchema),
      defaultValues: defaultFormValues,
    });
    
    const SignatureField = ({ fieldName, title, adminOnly = false }: { fieldName: keyof EmployeeOrientationAgreementFormData; title: string; adminOnly?: boolean; }) => {
        const signatureData = form.watch(fieldName);
        const disabled = isPrintMode || (adminOnly && !isAnAdmin);
        
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
        if (existingData?.fullName && !form.getValues('orientationAgreementEmployeeName')) {
            form.setValue('orientationAgreementEmployeeName', existingData.fullName);
        }
    }, [existingData, form]);

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<EmployeeOrientationAgreementFormData> = {};
            const formSchemaKeys = Object.keys(employeeOrientationAgreementSchema.shape) as Array<keyof EmployeeOrientationAgreementFormData>;
            
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

    const onSubmit = (data: EmployeeOrientationAgreementFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveEmployeeOrientationAgreementData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Employee Orientation Agreement has been saved."});
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
            <CardHeader className="text-center">
                <Image src={logoUrl} alt="FirstLight Home Care Logo" width={250} height={50} className="object-contain mx-auto mb-4" />
                <CardTitle className="text-xl tracking-wide">
                    EMPLOYEE ORIENTATION AGREEMENT
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>I certify that I have received a copy of the FirstLight Employee Manual or have access to the online version and will read and familiarize myself with its contents. I understand that the FirstLight Home Care Administrator or Care Coordinator will answer any questions I may have regarding the contents of the document.</p>
                    <p>I understand that the policies contained in the Manual are intended for guidance only, and may be unilaterally amended by FirstLight without notice.</p>
                    <p>I further understand that the FirstLight Manual does not create a contract of employment, but rather my employment with FirstLight is on an at-will basis. As such, I am free to resign at anytime, and FirstLight may end my employment at anytime, for any reason or no reason at all, with or without notice.</p>
                    <p>I further agree to follow the policies and procedures, which are emphasized during my orientation as outlined below:</p>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold">EMPLOYMENT POLICIES:</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground pl-4">
                        <li>I understand that as a FirstLight employee I will begin employment on a 90-day probationary period. Work performance and punctuality will be monitored and documented during this time.</li>
                        <li>I understand FirstLight payroll procedures and cycle.</li>
                        <li>I further understand that I will not be paid unless I follow the clock-in and clock-out procedure outlined in the Clock-In Instructions document and Caregiver Portal Brochure.</li>
                        <li>I understand that only neat and clean attire are considered appropriate dress for assignments.</li>
                        <li>I will not actively seek employment with a FirstLight customer.</li>
                        <li>I further understand that accepting employment with a FirstLight customer in which I was placed on an assignment can result in monies owed to FirstLight by the Client and myself of up to $5,000.</li>
                        <li>If I am unable to report to work or if I will be late, I will call FirstLight four (4) business hours prior to the start of my assignment. If I do not report to work and fail to call with an explanation, my action will be considered a "voluntary resignation".</li>
                        <li>I understand that switching shifts or days with other FirstLight employees without prior authorization from FirstLight staff approval is not allowed.</li>
                        <li>FirstLight employees are authorized to schedule shifts with institutional work site managers without prior authorization of FirstLight staff. Please notify the office as soon as possible to ensure the schedule reflects the change.</li>
                        <li>I understand that FirstLight cannot control customer cancellations of shifts assigned.</li>
                        <li>I understand that if I call off for two(2) or more consecutive shifts(days) for medical reasons, I may be asked to provide a doctor's clearance to work prior to future scheduling of shifts.</li>
                        <li>I understand the Communicable Disease guidelines and will report changes in my health status to FirstLight.</li>
                        <li>I understand that repeated tardiness for scheduled shifts will result in customer requests not to schedule me on future assignments. This can also result in termination of employment with FirstLight.</li>
                        <li>I understand that, if available, I have the option of choosing whether to have benefits(health insurance and paid vacation time) or to be paid more money per hour if I do not need or want benefits. It is my responsibility to complete the benefits enrollment process within the time period stated. I understand that I must enroll for FirstLight benefits within my first 90 days of employment. If I choose not to, or fail to enroll by this date, I will not be able to enroll for benefits until the next open enrollment period(subject to change).</li>
                        <li>I will not smoke in a client’s home, even if that client is a smoker.</li>
                        <li>I am obligated to notify FirstLight by the next working day if I am being investigated by any governmental agency for any act, offense or omission, including an investigation related to the abuse or neglect, or threat of abuse or neglect to a child or other client, or an investigation related to misappropriation of a client’s property.</li>
                        <li>I understand that my image reflects directly upon FirstLight.</li>
                        <li>I will conduct myself professionally, will not use profanity, and will not disclose a client’s personal information to anyone.</li>
                        <li>I understand that the sale or use of drugs and/or intoxicating beverages while on a FirstLight assignment is strictly prohibited.</li>
                        <li>I understand that I may be tested and checked for drugs and/or alcohol if I am injured on the job and go to a medical facility for treatment.</li>
                        <li>If I am injured while in the course of my work, I will report the injury to my supervisor and to FirstLight at once. Any incident involving the client will be reported to FirstLight as soon as possible.</li>
                        <li>I have been familiarized with the forms I am expected to complete while working in the field.</li>
                        <li>I am aware that I should contact the office if I think a client could benefit from assistance from other community agencies.</li>
                        <li>I agree to finish all the training assigned to be before I get client assignment. I understand that I may not be provided a client assignment if the training is not completed.</li>
                    </ul>
                </div>
                
                <div className="space-y-6 pt-6">
                    <FormField control={form.control} name="orientationAgreementEmployeeName" render={({ field }) => (
                        <FormItem><FormLabel>Employee Name (Printed)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <SignatureField fieldName="orientationAgreementSignature" title="Employee Signature" />
                        <FormField control={form.control} name="orientationAgreementSignatureDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <SignatureField fieldName="orientationAgreementWitnessSignature" title="FirstLight Home Care Witness" adminOnly={true} />
                         <FormField control={form.control} name="orientationAgreementWitnessDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} disabled={!isAnAdmin} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={!isAnAdmin} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
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
