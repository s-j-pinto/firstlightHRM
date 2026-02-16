
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
import { clientAbandonmentSchema, type ClientAbandonmentFormData, type CaregiverProfile } from "@/lib/types";
import { saveClientAbandonmentData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/Client-Abandonment.png?alt=media&token=3d99d712-9c7e-41c8-b71b-72798d29890c";


const defaultFormValues: ClientAbandonmentFormData = {
  clientAbandonmentPrintedName: '',
  clientAbandonmentSignature: '',
  clientAbandonmentSignatureDate: undefined,
  clientAbandonmentWitnessSignature: '',
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

export default function ClientAbandonmentPage() {
    const applicantSigPadRef = useRef<SignatureCanvas>(null);
    const witnessSigPadRef = useRef<SignatureCanvas>(null);
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
    
    const form = useForm<ClientAbandonmentFormData>({
      resolver: zodResolver(clientAbandonmentSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (isPrintMode && !isDataLoading) {
          setTimeout(() => window.print(), 1000);
        }
    }, [isPrintMode, isDataLoading]);

    useEffect(() => {
        if (existingData) {
            const formData:Partial<ClientAbandonmentFormData> = {};
            const formSchemaKeys = Object.keys(clientAbandonmentSchema.shape) as Array<keyof ClientAbandonmentFormData>;
            
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

            if (formData.clientAbandonmentSignature && applicantSigPadRef.current) {
                applicantSigPadRef.current.fromDataURL(formData.clientAbandonmentSignature);
            }
            if (formData.clientAbandonmentWitnessSignature && witnessSigPadRef.current) {
                witnessSigPadRef.current.fromDataURL(formData.clientAbandonmentWitnessSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = (ref: React.RefObject<SignatureCanvas>, fieldName: keyof ClientAbandonmentFormData) => {
        ref.current?.clear();
        form.setValue(fieldName, '');
    };

    const onSubmit = (data: ClientAbandonmentFormData) => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveClientAbandonmentData(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Client Abandonment form has been saved."});
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
                <Image src={logoUrl} alt="Client Abandonment" width={100} height={100} className="object-contain" />
                <CardTitle className="text-2xl font-bold pt-4">Client Abandonment</CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                        Client abandonment is defined as the premature termination of the professional treatment relationship by the health care provider, such as you, without adequate notice or the client's consent. This is a form of negligence with the unilateral termination of the provider-client relationship, despite the client's continued need for care.
                    </p>
                    <p>
                        Client abandonment occurs after you as a caregiver has accepted responsibility for an assignment within the scheduled work shift. It may also occur if you as a caregiver fail to give reasonable notice to an employer of the intent to terminate the employer-employee relationship or contract leading to serious impairment in the delivery of professional caregiving to clients.
                    </p>
                    <h3 className="font-semibold text-foreground pt-2">The Caregiver-Client Relationship</h3>
                    <p>
                        The caregiver-client relationship begins when the caregiver accepts responsibility for providing care based upon a written or oral report of the client needs. It ends when that responsibility has been transferred to another caregiver along with communication detailing the client's needs.
                    </p>
                    <p>
                        Once a caregiving assignment has been accepted, it is the duty of the caregiver to fulfill the client care assignment or transfer responsibility for that care to another qualified person.
                    </p>
                    <h3 className="font-semibold text-foreground pt-2">Caregiver's Duty and Accountability</h3>
                    <p>
                        As mandatory reporters, caregivers have an additional duty to immediately report any unsafe client care to the Care Coordinator. This duty includes identifying and reporting staffing problems, protecting the health, safety and rights of the clients, preserving the caregiver's own integrity and safety, refusing a client care assignment based on concerns for client safety, and practicing with reasonable skill and safety.
                    </p>
                    <p>
                        A Healthcare Code of Ethics directs all caregivers to protect the health, safety, and rights of the client, to assume responsibility and it is the caregivers' obligation to provide optimum client care, and to establish, maintain, and improve health care environments and conditions of employment.
                    </p>
                    <h3 className="font-semibold text-foreground pt-2">Liabilities of Abandonment</h3>
                    <p>
                        In medical and therefore caregiver malpractice, four elements must be proven to demonstrate malpractice:
                    </p>
                    <ol className="list-decimal list-inside pl-4 space-y-2">
                        <li><strong>Duty exists</strong> when a relationship is created to provide care to the client. (FLHC has a Client Contract and you as an employed caregiver have a contract of duty with accepting an assignment.)</li>
                        <li><strong>Breach of duty</strong> occurs when there is a deviation from the normal standard of care. (The FLHC Policies and Plan of Care along with your orientation and training establish this standard of care.)</li>
                        <li><strong>Damages occur</strong> when harm is done, requiring an increased length of stay or an increased level of care. (If the FLHC client was left alone and something occurred causing an additional injury or illness.)</li>
                        <li><strong>Causation is proven</strong> when the results are directly attributable to an action or omission of care. (This is where it is proven the result of abandonment created the situation for additional injury or illness.)</li>
                    </ol>
                    <p>
                        FirstLight HomeCare provides care to vulnerable adults and therefore our policy and procedure includes the direct notification of the Care Coordinator verbally if a situation occurs where the caregiver needs to leave prior to the end of a shift or is unable to report to duty. The expectation is the caregiver remains with any client until another caregiver is present and able to provide care to the client.
                    </p>
                </div>
                <div className="space-y-6 pt-6">
                    <p className="font-semibold">
                        I have read and understand the following information on Client Abandonment. I understand abandonment and will never leave a client without care for any reason.
                    </p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <FormField control={form.control} name="clientAbandonmentPrintedName" render={({ field }) => (
                            <FormItem><FormLabel>Printed Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="clientAbandonmentSignatureDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>Signature</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={applicantSigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (applicantSigPadRef.current) {
                                            form.setValue('clientAbandonmentSignature', applicantSigPadRef.current.toDataURL())
                                        }
                                    }}
                                />
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(applicantSigPadRef, 'clientAbandonmentSignature')} className="mt-2">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Clear Signature
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label>Witness Signature</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={witnessSigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (isAnAdmin && witnessSigPadRef.current) {
                                            form.setValue('clientAbandonmentWitnessSignature', witnessSigPadRef.current.toDataURL())
                                        }
                                    }}
                                    onBegin={() => !isAnAdmin && witnessSigPadRef.current?.clear()}
                                />
                            </div>
                            {isAnAdmin && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => clearSignature(witnessSigPadRef, 'clientAbandonmentWitnessSignature')} className="mt-2">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Clear Signature
                                </Button>
                            )}
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
