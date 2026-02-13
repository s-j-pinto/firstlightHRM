
"use client";

import { useEffect, useTransition, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc } from "firebase/firestore";
import SignatureCanvas from 'react-signature-canvas';
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, X, Loader2, RefreshCw, CalendarIcon, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { referenceVerificationSchema, referenceVerificationObject, type ReferenceVerificationFormData, type CaregiverProfile } from "@/lib/types";
import { saveReferenceVerificationData } from "@/lib/candidate-hiring-forms.actions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const defaultFormValues: ReferenceVerificationFormData = {
    applicantSignature: '',
    applicantSignatureDate: undefined,
    company: '',
    supervisorName: '',
    emailOrFax: '',
    phone: '',
    employmentDates: '',
    position: '',
    startingSalary: '',
    endingSalary: '',
    teamworkRating: undefined,
    dependabilityRating: undefined,
    initiativeRating: undefined,
    qualityRating: undefined,
    customerServiceRating: undefined,
    overallPerformanceRating: undefined,
    resignationStatus: undefined,
    dischargedStatus: undefined,
    laidOffStatus: undefined,
    eligibleForRehire: undefined,
    wasDisciplined: undefined,
    disciplineExplanation: '',
};

const ratingOptions = ['Unsatisfactory', 'Below Average', 'Average', 'Above Average', 'Outstanding'];

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

const RatingScale = ({ name, control, label }: { name: keyof ReferenceVerificationFormData, control: any, label: string }) => (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-base">{label}</FormLabel>
          <FormControl>
            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-x-6 gap-y-2">
              {ratingOptions.map((value) => (
                <FormItem key={value} className="flex items-center space-x-2 space-y-0">
                  <FormControl><RadioGroupItem value={value} id={`${name}-${value}`} /></FormControl>
                  <Label htmlFor={`${name}-${value}`} className="font-normal">{value}</Label>
                </FormItem>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );


export default function ReferenceVerificationPage() {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();

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

    const form = useForm<ReferenceVerificationFormData>({
      resolver: zodResolver(referenceVerificationSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (existingData) {
            const formData: Partial<ReferenceVerificationFormData> = {};
            const formSchemaKeys = Object.keys(referenceVerificationObject.shape) as Array<keyof ReferenceVerificationFormData>;

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

            form.reset({ ...defaultFormValues, ...formData });

             if (existingData.applicantSignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(existingData.applicantSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('applicantSignature', '');
    };

    const onSubmit = (data: ReferenceVerificationFormData) => {
      const saveId = profileIdToLoad;
      if (!saveId) {
        toast({ title: 'Error', description: 'Cannot save form without a valid user or candidate ID.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveReferenceVerificationData(saveId, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Reference Verification form has been saved."});
          if(isAnAdmin) {
            router.push(`/candidate-hiring-forms?candidateId=${saveId}`);
          } else {
            router.push('/candidate-hiring-forms');
          }
        }
      });
    }

    const handleCancel = () => {
        if(isAnAdmin) {
            router.push(`/admin/advanced-search?search=${encodeURIComponent(existingData?.fullName || '')}`);
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
        <Card className="max-w-4xl mx-auto">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl tracking-wide font-headline">
                    FIRSTLIGHT HOMECARE REFERENCE VERIFICATION FORM
                </CardTitle>
                 <CardDescription className="pt-2">
                    PLEASE PRINT
                </CardDescription>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
                <div className="space-y-4">
                     <FormItem>
                        <FormLabel>Applicant’s First Name Middle Last</FormLabel>
                        <FormControl>
                            <Input value={existingData?.fullName || ''} disabled readOnly />
                        </FormControl>
                    </FormItem>
                    <p className="text-sm text-muted-foreground">I hereby give FirstLight HomeCare permission to obtain the employment references necessary to make a hiring decision and hold all persons giving references free from any and all liability resulting from this process. I waive any provision impeding the release of this information and agree to provide any information necessary for the release of this information beyond that provided on the employment application and this reference verification form.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label className="bg-yellow-200/70 p-1 rounded inline-block">Signature</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (sigPadRef.current) {
                                            form.setValue('applicantSignature', sigPadRef.current.toDataURL())
                                        }
                                    }}
                                />
                            </div>
                             <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2"><RefreshCw className="mr-2 h-4 w-4" />Clear Signature</Button>
                        </div>
                        <FormField control={form.control} name="applicantSignatureDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                       )} />
                    </div>
                </div>

                <Separator/>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">FORMER EMPLOYER CONTACT INFORMATION</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="company" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="supervisorName" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Supervisor’s Name and Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="emailOrFax" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Email and/or Fax #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField control={form.control} name="employmentDates" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Dates of Employment</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="position" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Position</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField control={form.control} name="startingSalary" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Starting Salary:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="endingSalary" render={({ field }) => ( <FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Ending Salary:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                <Separator />
                
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold">REFERENCE INFORMATION</h3>
                    <p className="text-sm text-muted-foreground"><span className="bg-yellow-200/70 p-1 rounded">Please rate yourself in the following categories as you feel your former supervisor will rate you:</span></p>
                    <RatingScale name="teamworkRating" control={form.control} label="TEAMWORK: The degree to which you are willing to work harmoniously with others; the extent to which you conform to the policies of management." />
                    <RatingScale name="dependabilityRating" control={form.control} label="DEPENDABILITY: The extent to which you can be depended upon to be available for work and do it properly; the degree to which you are reliable and trustworthy; the extent to which you are able to work scheduled days and times, as well as your willingness to work additional hours if needed." />
                    <RatingScale name="initiativeRating" control={form.control} label="INITIATIVE: The degree to which you act independently in new situations; the extent to which you see what needs to be done and do it without being told; the degree to which you do your best to be an outstanding employee." />
                    <RatingScale name="qualityRating" control={form.control} label="QUALITY: The degree to which your work is free from errors and mistakes; the extent to which your work is accurate; the quality of your work in general." />
                    <RatingScale name="customerServiceRating" control={form.control} label="CUSTOMER SERVICE: The degree to which you relate to the customer’s needs and/or concerns." />
                    <RatingScale name="overallPerformanceRating" control={form.control} label="OVERALL PERFORMANCE: The degree to which your previous employer was satisfied with your efforts and achievements, as well as your eligibility for rehire." />
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-8">
                        <FormField control={form.control} name="resignationStatus" render={({field}) => (<FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Did you resign from this position?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem></RadioGroup></FormControl><FormMessage/></FormItem>)} />
                        <FormField control={form.control} name="dischargedStatus" render={({field}) => (<FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Discharged?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem></RadioGroup></FormControl><FormMessage/></FormItem>)} />
                        <FormField control={form.control} name="laidOffStatus" render={({field}) => (<FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Laid-Off?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem></RadioGroup></FormControl><FormMessage/></FormItem>)} />
                    </div>
                     <FormField control={form.control} name="eligibleForRehire" render={({field}) => (<FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Are you eligible for rehire?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem></RadioGroup></FormControl><FormMessage/></FormItem>)} />
                    <FormField control={form.control} name="wasDisciplined" render={({field}) => (<FormItem><FormLabel className="bg-yellow-200/70 p-1 rounded inline-block">Were you ever disciplined on the job?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem></RadioGroup></FormControl><FormMessage/></FormItem>)} />
                    {form.watch('wasDisciplined') === 'Yes' && (
                        <FormField control={form.control} name="disciplineExplanation" render={({ field }) => ( <FormItem><FormLabel>Explain:</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )} />
                    )}
                </div>

                <p className="text-sm text-left text-muted-foreground pt-4">Someone from FirstLight HomeCare will be following up with your shortly regarding the employment reference verification check. If you have any questions, please call: 909-321-4466</p>

            </CardContent>
            <CardFooter className="flex justify-end gap-4">
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

    