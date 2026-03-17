
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
import { caregiverResponsibilitiesSchema, type CaregiverResponsibilitiesFormData, type CaregiverProfile } from "@/lib/types";
import { saveCaregiverResponsibilitiesData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const defaultFormValues: CaregiverResponsibilitiesFormData = {
  caregiverResponsibilitiesSignature: '',
  caregiverResponsibilitiesSignatureDate: undefined,
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
                        canvasProps={{ className: 'w-full h-full rounded-md bg-white' }}
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

export default function CaregiverResponsibilitiesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const [activeSignature, setActiveSignature] = useState<{ fieldName: keyof CaregiverResponsibilitiesFormData; title: string; } | null>(null);
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
    
    const settingsRef = useMemoFirebase(() => (isAnAdmin ? doc(firestore, 'settings', 'availability') : null), [isAnAdmin, firestore]);
    const { data: settingsData, isLoading: isSettingsLoading } = useDoc<any>(settingsRef);

    const form = useForm<CaregiverResponsibilitiesFormData>({
      resolver: zodResolver(caregiverResponsibilitiesSchema),
      defaultValues: defaultFormValues,
    });
    
    const SignatureField = ({ fieldName, title, adminOnly = false, isReadOnly = false }: { fieldName: keyof CaregiverResponsibilitiesFormData; title: string; adminOnly?: boolean; isReadOnly?: boolean; }) => {
        const signatureData = form.watch(fieldName);
        const buttonDisabled = isPrintMode || (adminOnly && !isAnAdmin) || isReadOnly;
        
        return (
            <div className="space-y-2 flex-1">
                <FormLabel>{title}</FormLabel>
                <div className="relative rounded-md border bg-muted/30 h-28 flex items-center justify-center">
                    {signatureData ? (
                        <Image src={signatureData as string} alt="Signature" layout="fill" objectFit="contain" />
                    ) : (
                        <span className="text-muted-foreground">Not Signed</span>
                    )}
                     {!buttonDisabled && (
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
            const formData:Partial<CaregiverResponsibilitiesFormData> = {};
            const formSchemaKeys = Object.keys(caregiverResponsibilitiesSchema.shape) as Array<keyof CaregiverResponsibilitiesFormData>;
            
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

    const onSubmit = (data: CaregiverResponsibilitiesFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveCaregiverResponsibilitiesData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Caregiver Responsibilities form has been saved."});
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
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className={cn("max-w-4xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader>
                <CardTitle className="text-2xl tracking-wide text-center">CAREGIVER RESPONSIBILITIES</CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <ul className="list-disc list-inside space-y-4 text-sm text-muted-foreground">
                    <li><strong>Clock In and Out.</strong> Best to clock in as you exit your car or before you ring the doorbell, once you walk in the door and get distracted. Best to clock out after you close the client’s door, before you go to your car.</li>
                    <li><strong>Call Offs</strong> - On ALL Call-offs the Caregivers must CALL the office a minimum of 4 hours before their shift and give the reason for the call off. Between 7 pm and 8 am, if no one answers the first time, call again. Follow up with a text.</li>
                    <li><strong>HIPPA</strong>
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Keep the client's business confidential. Be careful not to discuss current or previous assignments while you are on the job.</li>
                            <li>Do not conduct your personal business, including personal phone calls, while on duty with a client.</li>
                            <li>It is never appropriate to bring a guest (family member, friend, etc) and it is strictly prohibited. to a client’s home,</li>
                        </ul>
                    </li>
                    <li><strong>Gifts:</strong> It is against FLHC Rancho Cucamonga policy to accept any type of gratuity, i.e, money or gifts.</li>
                    <li><strong>Badges</strong>
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Place in a lanyard that you have purchased or pin to shirt.</li>
                            <li>Display badge when in a facility or with the client.</li>
                        </ul>
                    </li>
                    <li><strong>Lifting:</strong>
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Do not lift or carry a client!</li>
                            <li>2 Persons must assist when using the Hoyer Lift: a Caregiver and a family member.</li>
                        </ul>
                    </li>
                    <li><strong>Dress Code. mask)</strong>
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Caregivers must wear scrubs and a mask (unless you or the client prefers not to wear a</li>
                            <li>Neat and clean professional</li>
                            <li>No long or artificial fingernails due to infection and potential injury to clients.</li>
                            <li>An employee is not allowed to wear excessive jewelry or any body piercing jewelry other than a small pair of earrings. If you have tattoos, they should not be visible.</li>
                            <li>Wear closed-toe shoes, preferably sneakers.</li>
                            <li>Employees should avoid excessive perfume, cologne, aftershave, or scented lotions.</li>
                            <li>If the employee is a smoker, clothing and hair should not smell like cigarette smoke.</li>
                        </ul>
                    </li>
                    <li><strong>Drugs and Alcohol:</strong> FLHC has a zero-tolerance policy for drugs and alcohol.</li>
                    <li><strong>Meals:</strong> Caregiver must bring their own meal and drinks. It can be placed in the refrigerator if the client does not mind.</li>
                    <li><strong>Emergencies and Concerns:</strong> Communicate with the office any concerns with the client as they happen. Call if urgent matter. If the call goes to voicemail and your matter is urgent, immediately call back. If we are on a call and we see you have called twice, we will put our call on hold and immediately take your call or call you back.</li>
                    <li><strong>Injuries</strong> to the client or caregiver must be reported to the office immediately. An Incident Report must be completed.</li>
                    <li><strong>Infection Control:</strong> Precautions require that all blood and other body fluids be treated as if they are infectious.
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Hand hygiene is, proper washing of hands before and after patient contact.</li>
                            <li>Always wash your hands before handling food</li>
                            <li>Wash your hands after using the toilet</li>
                            <li>Remember to wash your hands after blowing your nose.</li>
                            <li>Use of appropriate protective equipment (i.e., gloves) before patient contact.</li>
                            <li>Respiratory hygiene (i.e., covering your cough and sneeze)</li>
                            <li>Injection and sharp object safety and proper disposal.</li>
                            <li>Do not remove or interfere with any dressings applied by nursing staff</li>
                            <li>All procedures involving blood or other potentially infectious materials shall be performed in such a manner as to minimize splashing, spraying, spattering, and the generation of droplets of these substances.</li>
                        </ul>
                    </li>
                    <li><strong>Client Notes:</strong> Complete client notes in the notebook, for review by family and other caregivers.
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Place header at the top of the page: Client Name, Caregiver Name, Date, Shift hours</li>
                            <li>Document notes in the notebook in the client folder (or the FLHC app). Preferably, as you do the duty, rather than all the notes at the end of the shift. At the end of the shift, take a picture of the note and text to the office number 909-321-4466 or complete the note section on the FLHC app (read the note into the microphone)</li>
                            <li>Communicate with the office any concerns with the client as they happen.</li>
                            <li>How much did the client eat and drink</li>
                            <li>How is the client feeling, in pain? Lack of appetite? Depressed? Etc.</li>
                            <li>What are you doing with clients to keep them engaged or entertained?</li>
                            <li>What is the client’s attitude? Happy, sad, upset, etc.</li>
                            <li>Comments or concerns</li>
                            <li>Visitors: name, function, how long did they stay?</li>
                            <li>Where have you taken him/her, and what did he do there? i.e., store, visit family, etc.</li>
                            <li>What was discussed at the doctor's appointment? In detail, please</li>
                            <li>What personal care was given? Urine output, diarrhea, shower, sponge bath, etc.</li>
                            <li>Client vitals: BP, oxygen level, etc</li>
                            <li>Do not get involved with family issues; you are there for the client only</li>
                        </ul>
                    </li>
                    <li><strong>Training</strong> must be finished by the deadline, or shifts will not be assigned.</li>
                    <li><strong>TB tests & HCA registration</strong> must be kept current, or shifts will not be assigned.</li>
                    <li><strong>Client Abandonment:</strong> You cannot abandon the client for any reason. You must wait for relief or call the office, unless the client or family says otherwise.</li>
                </ul>

                 <p className="text-sm"><strong>Resigning:</strong> If you are resigning, please <mark className="bg-yellow-200 underline">submit in writing a minimum of 2 weeks notice</mark> so that we can provide staffing for the client.</p>

                <div className="space-y-6 pt-6">
                    <h3 className="font-semibold">Acknowledgement:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <SignatureField fieldName="caregiverResponsibilitiesSignature" title="Employee Signature" />
                         <FormField control={form.control} name="caregiverResponsibilitiesSignatureDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2 flex-1">
                            <Label>FLHC Witness</Label>
                             <div className="relative rounded-md border bg-muted/30 h-28 flex items-center justify-center">
                                {settingsData?.adminSignature ? (
                                    <Image src={settingsData.adminSignature as string} alt="Witness Signature" layout="fill" objectFit="contain" />
                                ) : (
                                    <span className="text-muted-foreground">Not Signed</span>
                                )}
                             </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                             <Label>Date</Label>
                             <Input value={format(new Date(), "PPP")} readOnly disabled/>
                        </div>
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

    