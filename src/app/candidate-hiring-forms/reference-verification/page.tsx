
"use client";

import { useEffect, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
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
import { referenceVerificationSchema, type ReferenceVerificationFormData, type CaregiverProfile } from "@/lib/types";
import { saveReferenceVerificationData } from "@/lib/candidate-hiring-forms.actions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const defaultFormValues: ReferenceVerificationFormData = {
  reference1_name: '',
  reference1_company: '',
  reference1_title: '',
  reference1_phone: '',
  reference1_employmentFrom: undefined,
  reference1_employmentTo: undefined,
  reference1_reasonForLeaving: '',
  reference1_wouldRehire: undefined,
  reference1_comments: '',
  reference2_name: '',
  reference2_company: '',
  reference2_title: '',
  reference2_phone: '',
  reference2_employmentFrom: undefined,
  reference2_employmentTo: undefined,
  reference2_reasonForLeaving: '',
  reference2_wouldRehire: undefined,
  reference2_comments: '',
  referenceVerificationSignature: '',
  referenceVerificationSignatureDate: undefined,
};

export default function ReferenceVerificationPage() {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();

    const caregiverProfileRef = useMemoFirebase(
      () => (user?.uid ? doc(firestore, 'caregiver_profiles', user.uid) : null),
      [user?.uid]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const form = useForm<ReferenceVerificationFormData>({
      resolver: zodResolver(referenceVerificationSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (existingData) {
            const formData: any = { ...defaultFormValues };
            Object.keys(defaultFormValues).forEach(key => {
                const formKey = key as keyof ReferenceVerificationFormData;
                const existingValue = (existingData as any)[formKey];
                if (existingValue !== undefined && existingValue !== null) {
                    if (formKey.endsWith('Date') || formKey.endsWith('From') || formKey.endsWith('To')) {
                         formData[formKey] = existingValue.toDate ? existingValue.toDate() : new Date(existingValue);
                    } else {
                         formData[formKey] = existingValue;
                    }
                }
            });
            form.reset(formData);
             if (formData.referenceVerificationSignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(formData.referenceVerificationSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('referenceVerificationSignature', '');
    };

    const onSubmit = (data: ReferenceVerificationFormData) => {
      if (!user?.uid) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveReferenceVerificationData(user.uid, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Reference Verification form has been saved."});
          router.push('/candidate-hiring-forms');
        }
      });
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
            <CardHeader>
                <CardTitle className="text-center text-2xl tracking-wide">
                    Reference Verification
                </CardTitle>
                 <CardDescription className="text-center pt-2">
                    List two professional references who are not related to you.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">

                {/* Reference 1 */}
                <div className="space-y-4 border p-4 rounded-md">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><User /> Reference 1</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="reference1_name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="reference1_phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="reference1_company" render={({ field }) => ( <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="reference1_title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="reference1_employmentFrom" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Dates of Employment (From)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="reference1_employmentTo" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Dates of Employment (To)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="reference1_reasonForLeaving" render={({ field }) => ( <FormItem><FormLabel>Reason for Leaving</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="reference1_wouldRehire" render={({ field }) => (
                        <FormItem className="space-y-2"><FormLabel>Would you rehire?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="yes" id="ref1-rehire-yes" /><Label htmlFor="ref1-rehire-yes" className="font-normal">Yes</Label></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="no" id="ref1-rehire-no" /><Label htmlFor="ref1-rehire-no" className="font-normal">No</Label></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="reference1_comments" render={({ field }) => ( <FormItem><FormLabel>Additional Comments</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                
                {/* Reference 2 */}
                <div className="space-y-4 border p-4 rounded-md">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><User /> Reference 2</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="reference2_name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="reference2_phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="reference2_company" render={({ field }) => ( <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="reference2_title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="reference2_employmentFrom" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Dates of Employment (From)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="reference2_employmentTo" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Dates of Employment (To)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="reference2_reasonForLeaving" render={({ field }) => ( <FormItem><FormLabel>Reason for Leaving</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="reference2_wouldRehire" render={({ field }) => (
                        <FormItem className="space-y-2"><FormLabel>Would you rehire?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="yes" id="ref2-rehire-yes" /><Label htmlFor="ref2-rehire-yes" className="font-normal">Yes</Label></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="no" id="ref2-rehire-no" /><Label htmlFor="ref2-rehire-no" className="font-normal">No</Label></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="reference2_comments" render={({ field }) => ( <FormItem><FormLabel>Additional Comments</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                
                 <Separator />

                 <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">I hereby authorize FirstLight Home Care to contact the references listed above to verify my employment and gather information about my work performance.</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>Applicant Signature</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (sigPadRef.current) {
                                            form.setValue('referenceVerificationSignature', sigPadRef.current.toDataURL())
                                        }
                                    }}
                                />
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Clear Signature
                            </Button>
                        </div>
                       <FormField control={form.control} name="referenceVerificationSignatureDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                       )} />
                    </div>
                </div>

            </CardContent>
            <CardFooter className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push('/candidate-hiring-forms')}>
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
