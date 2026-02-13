
"use client";

import { useRef, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, CalendarIcon } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { hcs501Schema, type Hcs501FormData, type CaregiverProfile } from "@/lib/types";
import { saveHcs501Data } from "@/lib/candidate-hiring-forms.actions";
import { format } from "date-fns";

// Define default values to ensure all form fields are controlled from the start.
const defaultFormValues: Hcs501FormData = {
  perId: '',
  hireDate: undefined,
  separationDate: undefined,
  fullName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  dob: undefined,
  ssn: '',
  tbDate: undefined,
  tbResults: '',
  additionalTbDates: '',
  alternateNames: '',
  validLicense: undefined,
  driversLicenseNumber: '',
  titleOfPosition: '',
  hcs501Notes: '',
  hcs501EmployeeSignature: '',
  hcs501SignatureDate: undefined,
};


export default function HCS501Page() {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";

    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    
    const caregiverProfileRef = useMemoFirebase(
      () => (user?.uid ? doc(firestore, 'caregiver_profiles', user.uid) : null),
      [user?.uid]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const form = useForm<Hcs501FormData>({
      resolver: zodResolver(hcs501Schema),
      defaultValues: defaultFormValues,
    });
    
    useEffect(() => {
        if (existingData) {
            const formData: Partial<Hcs501FormData & { fullName?: string; phone?: string; address?: string; city?: string; state?: string; zip?: string; driversLicenseNumber?: string; }> = {};
            // Use a whitelist of fields from the schema to populate the form
            const formFields = Object.keys(hcs501Schema.shape);
            
            formFields.forEach(key => {
                const typedKey = key as keyof Hcs501FormData;
                if (typedKey in existingData) {
                    const value = (existingData as any)[typedKey];
                    if (key.toLowerCase().includes('date') && value && typeof value.toDate === 'function') {
                        (formData as any)[typedKey] = value.toDate();
                    } else {
                        (formData as any)[typedKey] = value;
                    }
                }
            });

            // Also pre-populate from general profile if fields are empty
            if (!formData.fullName && existingData.fullName) formData.fullName = existingData.fullName;
            if (!formData.phone && existingData.phone) formData.phone = existingData.phone;
            if (!formData.address && existingData.address) formData.address = existingData.address;
            if (!formData.city && existingData.city) formData.city = existingData.city;
            if (!formData.state && existingData.state) formData.state = existingData.state;
            if (!formData.zip && existingData.zip) formData.zip = existingData.zip;
            if (!formData.driversLicenseNumber && existingData.driversLicenseNumber) formData.driversLicenseNumber = existingData.driversLicenseNumber;


            form.reset({
                ...defaultFormValues,
                ...formData
            });

            if (existingData.hcs501EmployeeSignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(existingData.hcs501EmployeeSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('hcs501EmployeeSignature', '');
    };
    
    const onSubmit = (data: Hcs501FormData) => {
      if (!user?.uid) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveHcs501Data(user.uid, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your HCS 501 form has been saved."});
          router.push('/candidate-hiring-forms');
        }
      });
    }

    if(isUserLoading || isDataLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="text-sm text-muted-foreground">
                        State of California – Health and Human Services Agency
                        <br />
                        California Department of Social Services
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                        Community Care Licensing Division
                        <br />
                        Home Care Services Bureau
                    </div>
                </div>
                <CardTitle className="text-center pt-4 tracking-wider">
                    PERSONNEL RECORD
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
                <div className="border p-4 rounded-md space-y-4">
                    <p className="text-center text-xs text-muted-foreground">(Form to be kept current at all times) FOR HOME CARE ORGANIZATION (HCO) USE ONLY</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hcoNumber">HCO Number</Label>
                            <Input id="hcoNumber" value="364700059" readOnly />
                        </div>
                        <FormField control={form.control} name="perId" render={({ field }) => (
                          <FormItem><FormLabel>Employee’s PER ID</FormLabel><FormControl><Input {...field} disabled={!isAnAdmin} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="hireDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Hire Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={!isAnAdmin}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={!isAnAdmin} /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="separationDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date of Separation</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={!isAnAdmin}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={!isAnAdmin} /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-lg font-semibold tracking-wider uppercase">
                    <span className="bg-card px-2 text-foreground">
                      Personal
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="fullName" render={({ field }) => (
                          <FormItem><FormLabel>Name (Last First Middle)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel>Area Code/Telephone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    
                    <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="state" render={({ field }) => (
                            <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="zip" render={({ field }) => (
                            <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="dob" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    captionLayout="dropdown-buttons"
                                    fromYear={1930}
                                    toYear={new Date().getFullYear() - 18}
                                    initialFocus
                                />
                            </PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="ssn" render={({ field }) => (
                            <FormItem><FormLabel>Social Security Number <span className="text-muted-foreground">(Voluntary for ID only)</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="tbDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date of TB Test Upon Hire</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    captionLayout="dropdown-buttons"
                                    fromYear={new Date().getFullYear() - 5}
                                    toYear={new Date().getFullYear()}
                                    initialFocus
                                />
                            </PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="tbResults" render={({ field }) => (
                            <FormItem><FormLabel>Results of Last TB Test</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                    </div>
                     <FormField control={form.control} name="additionalTbDates" render={({ field }) => (
                        <FormItem><FormLabel>Additional TB Test Dates (Please include test results)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="alternateNames" render={({ field }) => (
                        <FormItem><FormLabel>Please list any alternate names used (For example - maiden name)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <FormField control={form.control} name="validLicense" render={({ field }) => (
                           <FormItem className="space-y-2"><FormLabel>Do you possess a valid California driver’s license?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="yes" id="cdl-yes" /><Label htmlFor="cdl-yes" className="font-normal">Yes</Label></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="no" id="cdl-no" /><Label htmlFor="cdl-no" className="font-normal">No</Label></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="driversLicenseNumber" render={({ field }) => (
                           <FormItem><FormLabel>CDL Number:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                </div>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-lg font-semibold tracking-wider uppercase">
                        <span className="bg-card px-2 text-foreground">
                        POSITION INFORMATION
                        </span>
                    </div>
                </div>

                <div className="space-y-6">
                    <FormField control={form.control} name="titleOfPosition" render={({ field }) => (
                       <FormItem><FormLabel>Title of Position</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="hcs501Notes" render={({ field }) => (
                       <FormItem><FormLabel>Notes:</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="border p-4 rounded-md space-y-4">
                        <p className="text-sm font-bold">I hereby certify under penalty of perjury that I am 18 years of age or older and that the above statements are true and correct. I give my permission for any necessary verification.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="space-y-2">
                                <Label>Employee Signature</Label>
                                <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                    <SignatureCanvas
                                        ref={sigPadRef}
                                        penColor='black'
                                        canvasProps={{ className: 'w-full h-full rounded-md' }}
                                        onEnd={() => {
                                            if (sigPadRef.current) {
                                                form.setValue('hcs501EmployeeSignature', sigPadRef.current.toDataURL())
                                            }
                                        }}
                                    />
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Clear Signature
                                </Button>
                            </div>
                           <FormField control={form.control} name="hcs501SignatureDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                           )} />
                        </div>
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

    