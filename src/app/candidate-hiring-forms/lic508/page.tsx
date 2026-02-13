

"use client";

import { useEffect, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc } from "firebase/firestore";
import SignatureCanvas from 'react-signature-canvas';
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, X, Loader2, RefreshCw, CalendarIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { lic508Schema, type Lic508FormData, type CaregiverProfile } from "@/lib/types";
import { saveLic508Data } from "@/lib/candidate-hiring-forms.actions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const defaultFormValues: Lic508FormData = {
  convictedInCalifornia: undefined,
  convictedOutOfState: undefined,
  livedOutOfStateLast5Years: undefined,
  outOfStateHistory: "",
  lic508Signature: '',
  lic508SignatureDate: undefined,
};

export default function LIC508Page() {
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

    const form = useForm<Lic508FormData>({
      resolver: zodResolver(lic508Schema),
      defaultValues: defaultFormValues,
    });
    
    useEffect(() => {
        if (existingData) {
            const formData:any = { ...existingData };
             if (formData.lic508SignatureDate && typeof formData.lic508SignatureDate.toDate === 'function') {
                formData.lic508SignatureDate = formData.lic508SignatureDate.toDate();
            } else {
                formData.lic508SignatureDate = undefined;
            }

            form.reset({
                ...defaultFormValues,
                ...formData
            });

             if (formData.lic508Signature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(formData.lic508Signature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('lic508Signature', '');
    };

    const onSubmit = (data: Lic508FormData) => {
      if (!user?.uid) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveLic508Data(user.uid, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your LIC 508 form has been saved."});
          router.push('/candidate-hiring-forms');
        }
      });
    }
    
    const isLoading = isUserLoading || isDataLoading;
    const livedOutOfState = form.watch('livedOutOfStateLast5Years');

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
                <div className="text-sm text-muted-foreground">
                    State of California – Health and Human Services Agency
                    <br />
                    California Department of Social Services
                </div>
                <CardTitle className="text-center pt-4 tracking-wider">
                    CRIMINAL RECORD STATEMENT & OUT-OF-STATE DISCLOSURE
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="pt-6 space-y-6">
                <Separator />
                <p className="text-sm text-muted-foreground mt-6 text-center">
                    State law requires that persons associated with licensed care facilities, Home Care Aide Registry or TrustLine Registry applicants be fingerprinted and disclose any conviction. A conviction is any plea of guilty or nolo contendere (no contest) or a verdict of guilty. The fingerprints will be used to obtain a copy of any criminal history you may have.
                </p>

                <div className="border p-4 rounded-md space-y-6">
                     <div>
                         <FormField
                            control={form.control}
                            name="convictedInCalifornia"
                            render={({ field }) => (
                               <FormItem className="space-y-3">
                                   <FormLabel>Have you ever been convicted of a crime in California?</FormLabel>
                                   <FormControl>
                                       <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                           <FormItem className="flex items-center space-x-2">
                                               <RadioGroupItem value="yes" id="convicted-yes" />
                                               <FormLabel htmlFor="convicted-yes" className="font-normal">Yes</FormLabel>
                                           </FormItem>
                                           <FormItem className="flex items-center space-x-2">
                                               <RadioGroupItem value="no" id="convicted-no" />
                                               <FormLabel htmlFor="convicted-no" className="font-normal">No</FormLabel>
                                           </FormItem>
                                       </RadioGroup>
                                   </FormControl>
                                   <FormMessage />
                               </FormItem>
                            )}
                        />
                        <p className="text-xs text-muted-foreground pt-2">
                            You do not need to disclose any marijuana-related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <FormField
                            control={form.control}
                            name="convictedOutOfState"
                            render={({ field }) => (
                               <FormItem>
                                   <FormLabel>Have you ever been convicted of a crime from another state, federal court, military, or jurisdiction outside of U.S.?</FormLabel>
                                   <FormControl>
                                       <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                           <FormItem className="flex items-center space-x-2">
                                               <RadioGroupItem value="yes" id="convicted-oos-yes" />
                                               <FormLabel htmlFor="convicted-oos-yes" className="font-normal">Yes</FormLabel>
                                           </FormItem>
                                           <FormItem className="flex items-center space-x-2">
                                               <RadioGroupItem value="no" id="convicted-oos-no" />
                                               <FormLabel htmlFor="convicted-oos-no" className="font-normal">No</FormLabel>
                                           </FormItem>
                                       </RadioGroup>
                                   </FormControl>
                                   <FormMessage />
                               </FormItem>
                            )}
                        />
                         <p className="text-xs text-muted-foreground pt-2">
                            You do not need to disclose convictions that were a result of ones's status as a victim of human trafficking and that were dismissed pursuant to Penal Code Section 1203.49, nor any marijuana related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7. However you are required to disclose convictions that were dismissed pursuant to Penal Code Section 1203.4(a)
                        </p>
                    </div>
                </div>
                
                 <p className="text-sm text-muted-foreground mt-6 text-center">
                    Criminal convictions from another State or Federal court are considered the same as criminal convictions in California
                </p>

                <Separator />

                <div className="space-y-4 pt-4">
                    <p className="text-sm font-semibold">
                        For Children's Residential Facilities, not including Foster Family Agency Staff, Youth Homelessness Prevention Centers , Private Alternative Boarding Schools, Private Alternative Outdoor Program, or Crisis Nurseries: 
                    </p>
                    <FormField
                        control={form.control}
                        name="livedOutOfStateLast5Years"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Have you lived in a state other than California within the last five years?</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                        <FormItem className="flex items-center space-x-2">
                                            <RadioGroupItem value="yes" id="lived-oos-yes" />
                                            <FormLabel htmlFor="lived-oos-yes" className="font-normal">Yes</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2">
                                            <RadioGroupItem value="no" id="lived-oos-no" />
                                            <FormLabel htmlFor="lived-oos-no" className="font-normal">No</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {livedOutOfState === 'yes' && (
                        <FormField
                            control={form.control}
                            name="outOfStateHistory"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>If yes, list each state below and then complete an LIC 198B for each state:</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="List states here..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>
                
                <div className="mt-4 text-sm text-muted-foreground">
                    <p>You must check yes to the corresponding question(s) above to report every conviction (including reckless and drunk driving convictions), you have on your record even if:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>It happened a long time ago;</li>
                        <li>It was only a misdemeanor;</li>
                        <li>You didn’t have to go to court (your attorney went for you);</li>
                        <li>You had no jail time, or the sentence was only a fine or probation;</li>
                        <li>You received a certificate of rehabilitation; or</li>
                        <li>The conviction was later dismissed, set aside or the sentence was suspended.</li>
                    </ul>
                </div>
                <Separator />
                <div className="space-y-4 pt-4 text-sm text-muted-foreground">
                    <p className="font-bold text-destructive">
                        NOTE: IF THE CRIMINAL BACKGROUND CHECK REVEALS ANY CONVICTION(S) THAT YOU DID NOT
                        REPORT ON THIS FORM BY CHECKING YES, YOUR FAILURE TO DISCLOSE THE CONVICTION(S)
                        MAY RESULT IN AN EXEMPTION DENIAL, APPLICATION DENIAL, LICENSE REVOCATION,
                        DECERTIFICATION, RESCISSION OF APPROVAL, OR EXCLUSION FROM A LICENSED FACILITY,
                        CERTIFIED FAMILY HOME, OR THE HOME OF A RESOURCE FAMILY.
                    </p>
                    <p>
                        If you move or change your mailing address, you must send your updated information to the Caregiver
                        Background Check Bureau within 10 days to:
                    </p>
                    <p className="pl-4">
                        Caregiver Background Check Bureau<br />
                        744 P Street, M/S T9-15-62<br />
                        Sacramento, CA 95814
                    </p>
                </div>

                <Separator />

                <div className="space-y-6 pt-4">
                    <p className="text-sm">I declare under penalty of perjury under the laws of the State of California that I have read and understand the information contained in this affidavit and that my responses and any accompanying attachments are true and correct.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <Label>FACILITY/ORGANIZATION/AGENCY NAME:</Label>
                            <Input value="FirstLight Home Care of Rancho Cucamonga" readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>FACILITY/ORGANIZATION/AGENCY NUMBER:</Label>
                            <Input value="364700059" readOnly disabled />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <Label>YOUR NAME (print clearly):</Label>
                            <Input value={existingData?.fullName || ''} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>YOUR ADDRESS (street, city, state, zip):</Label>
                            <Input value={`${existingData?.address || ''}, ${existingData?.city || ''}, ${existingData?.state || ''} ${existingData?.zip || ''}`} readOnly disabled />
                        </div>
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="space-y-1">
                            <Label>SOCIAL SECURITY NUMBER:</Label>
                            <Input value={existingData?.ssn || ''} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>DRIVER’S LICENSE NUMBER/STATE:</Label>
                            <Input value={existingData?.driversLicenseNumber || ''} readOnly disabled />
                        </div>
                         <div className="space-y-1">
                            <Label>DATE OF BIRTH:</Label>
                            <Input value={existingData?.dob ? format(new Date((existingData.dob as any).toDate()), 'MM/dd/yyyy') : ''} readOnly disabled />
                        </div>
                    </div>
                    
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>SIGNATURE:</Label>
                            <div className="relative w-full h-24 rounded-md border bg-muted/50">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor='black'
                                    canvasProps={{ className: 'w-full h-full rounded-md' }}
                                    onEnd={() => {
                                        if (sigPadRef.current) {
                                            form.setValue('lic508Signature', sigPadRef.current.toDataURL())
                                        }
                                    }}
                                />
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="mt-2">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Clear Signature
                            </Button>
                        </div>
                       <FormField control={form.control} name="lic508SignatureDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>DATE:</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                       )} />
                    </div>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground pt-4">
                    <p className="font-bold">Instructions to Licensees:</p>
                    <p>If the person discloses that they have ever been convicted of a crime, maintain this form in your facility/organization personnel file and send a copy to your Licensed Program Analyst (LPA) or assigned analyst.</p>
                    <p className="font-bold mt-2">Instructions to Regional Offices and Foster Family Agencies:</p>
                    <p>If ‘Yes’ is indicated in any box above, forward a copy of this completed form (and the LIC 198B, as applicable) to the Caregiver Background Check Bureau, 744 P Street, MS T9-15-62, Sacramento, CA 95814.</p>
                    <p>If ‘No’ is indicated above in all boxes, keep this completed form in the facility file.</p>
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
