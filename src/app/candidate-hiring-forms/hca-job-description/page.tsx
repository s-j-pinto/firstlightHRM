
"use client";

import { useRef, useEffect, useTransition } from "react";
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
import { RefreshCw, Save, X, Loader2, CalendarIcon } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { hcaJobDescriptionSchema, type HcaJobDescriptionFormData, type CaregiverProfile } from "@/lib/types";
import { saveHcaJobDescriptionData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";


const defaultFormValues: HcaJobDescriptionFormData = {
  jobDescriptionSignature: '',
  jobDescriptionSignatureDate: undefined,
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

export default function HcaJobDescriptionPage() {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();

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
    
    const form = useForm<HcaJobDescriptionFormData>({
      resolver: zodResolver(hcaJobDescriptionSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<HcaJobDescriptionFormData> = {};
            const formSchemaKeys = Object.keys(hcaJobDescriptionSchema.shape) as Array<keyof HcaJobDescriptionFormData>;
            
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

            if (formData.jobDescriptionSignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(formData.jobDescriptionSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('jobDescriptionSignature', '');
    };

    const onSubmit = (data: HcaJobDescriptionFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveHcaJobDescriptionData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Job Description acknowledgement has been saved."});
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
             <CardHeader className="flex flex-row items-start justify-between">
                <Image src={logoUrl} alt="FirstLight Home Care Logo" width={250} height={50} className="object-contain" />
                <div>
                    <CardTitle className="text-2xl text-center tracking-wide">
                        JOB DESCRIPTION
                    </CardTitle>
                    <CardDescription className="text-center font-bold pt-2 text-lg text-foreground">
                        Home Care Aide
                    </CardDescription>
                </div>
                <div className="w-[250px]"></div>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <h3 className="font-bold">JOB SUMMARY:</h3>
                    <p className="text-sm text-muted-foreground pl-4">An individual who has completed personal care training and is competent to perform assigned functions of personal care to the client in their residence.</p>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold">QUALIFICATIONS:</h3>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground pl-4 space-y-1">
                        <li>Must have completed personal care training program and competency.</li>
                        <li>Have a sympathetic attitude toward the care of the sick and elderly.</li>
                        <li>Ability to carry out directions, read and write.</li>
                        <li>Maturity and ability to deal effectively with the demands of the job.</li>
                    </ol>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold">RESPONSIBILITIES:</h3>
                     <ol className="list-decimal list-inside text-sm text-muted-foreground pl-4 space-y-1">
                        <li>Assist clients with personal hygiene, including shower, tub or bed baths, oral care, hair and skin care.</li>
                        <li>Assist clients in the use of toilet facilities, including bed pans.</li>
                        <li>Assist clients in and out of bed, excluding the use of mechanical lifting equipment unless trained and documented as competent.</li>
                        <li>Assist clients with walking, including the use of walkers and wheelchairs, when applicable.</li>
                        <li>Assist clients with self-administration of medications.</li>
                        <li>Meal preparation and feeding, when required.</li>
                        <li>Assist with prescribed exercises when the client and the aide have been instructed by the appropriate health professional.</li>
                        <li>Record and report changes in the client’s physical condition, behavior or appearance to supervisor or Case Coordinator.</li>
                        <li>Documenting services delivered in accordance with FirstLight Home Care policies and procedures.</li>
                    </ol>
                </div>
                 <div className="space-y-4">
                    <h3 className="font-bold">WORKING ENVIRONMENT:</h3>
                    <p className="text-sm text-muted-foreground pl-4">Works both indoors in the Agency office and in the field with clients and referral sources.</p>
                </div>
                 <div className="space-y-4">
                    <h3 className="font-bold">JOB RELATIONSHIPS:</h3>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground pl-4">
                        <li>Supervised by: Lolita Pinto, Managing Director</li>
                    </ol>
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold">RISK EXPOSURE:</h3>
                    <p className="text-sm text-muted-foreground pl-4">High risk</p>
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold">LIFTING REQUIREMENTS:</h3>
                    <p className="text-sm text-muted-foreground pl-4">Ability to perform the following tasks if necessary:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground pl-8 space-y-1">
                        <li>Ability to participate in physical activity.</li>
                        <li>Ability to work for extended period of time while standing and being involved in physical activity.</li>
                        <li>Heavy lifting.</li>
                        <li>Ability to do extensive bending, lifting and standing on a regular basis.</li>
                    </ul>
                </div>
                
                 <div className="space-y-6 pt-6">
                    <p className="text-sm">I have read the above job description and fully understand the conditions set forth therein, and if employed as a Personal Care Assistant, I will perform these duties to the best of my knowledge and ability.</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <FormField control={form.control} name="jobDescriptionSignatureDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                        <div className="space-y-2">
                            <Label>Signature</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (sigPadRef.current) {
                                            form.setValue('jobDescriptionSignature', sigPadRef.current.toDataURL())
                                        }
                                    }}
                                />
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Clear Signature
                            </Button>
                        </div>
                    </div>
                </div>

            </CardContent>
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

