
"use client";

import { useEffect, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc } from "firebase/firestore";
import SignatureCanvas from 'react-signature-canvas';
import { format } from "date-fns";
import { z } from "zod";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, X, Loader2, RefreshCw, CalendarIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { lic508Object, type CaregiverProfile } from "@/lib/types";
import { saveLic508Data } from "@/lib/candidate-hiring-forms.actions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const lic508PageSchema = lic508Object.passthrough().extend({
  fullName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
}).refine(data => {
    if (data.livedOutOfStateLast5Years === 'yes') {
        return !!data.outOfStateHistory && data.outOfStateHistory.length > 0;
    }
    return true;
}, {
    message: "Please list the states you have lived in.",
    path: ['outOfStateHistory'],
});
type Lic508PageFormData = z.infer<typeof lic508PageSchema>;

const defaultFormValues: Lic508PageFormData = {
  convictedInCalifornia: undefined,
  convictedOutOfState: undefined,
  livedOutOfStateLast5Years: undefined,
  outOfStateHistory: "",
  lic508Signature: '',
  lic508SignatureDate: undefined,
  fullName: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  ssn: '',
  driversLicenseNumber: '',
  dob: undefined,
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

export default function LIC508Page() {
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

    const form = useForm<Lic508PageFormData>({
      resolver: zodResolver(lic508PageSchema),
      defaultValues: defaultFormValues,
    });
    
    useEffect(() => {
        if (existingData) {
            const formData: Partial<Lic508PageFormData> = {};
            const formSchemaKeys = Object.keys(lic508Object.shape) as Array<keyof Lic508FormData>;

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
            
            // Also pre-populate from general profile if fields are empty
            if (!formData.fullName && existingData.fullName) formData.fullName = existingData.fullName;
            if (!formData.address && existingData.address) formData.address = existingData.address;
            if (!formData.city && existingData.city) formData.city = existingData.city;
            if (!formData.state && existingData.state) formData.state = existingData.state;
            if (!formData.zip && existingData.zip) formData.zip = existingData.zip;
            if (!formData.driversLicenseNumber && existingData.driversLicenseNumber) formData.driversLicenseNumber = existingData.driversLicenseNumber;
            if (!formData.ssn && existingData.ssn) formData.ssn = existingData.ssn;
            if (!formData.dob && existingData.dob) (formData as any).dob = safeToDate(existingData.dob);


            form.reset({
                ...defaultFormValues,
                ...formData
            });

             if (existingData.lic508Signature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(existingData.lic508Signature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('lic508Signature', '');
    };

    const onSubmit = (data: Lic508PageFormData) => {
      const saveId = profileIdToLoad;
      if (!saveId) {
        toast({ title: 'Error', description: 'Cannot save form without a valid user or candidate ID.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveLic508Data(saveId, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your LIC 508 form has been saved."});
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
                     <div className="space-y-3">
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
                         <p className="text-xs text-muted-foreground pt-3">
                            You do not need to disclose any marijuana-related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <FormField
                            control={form.control}
                            name="convictedOutOfState"
                            render={({ field }) => (
                               <FormItem className="space-y-3">
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
                         <p className="text-xs text-muted-foreground pt-3">
                            You do not need to disclose convictions that were a result of ones's status as a victim of human trafficking and that were dismissed pursuant to Penal Code Section 1203.49, nor any marijuana related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7. However you are required to disclose convictions that were dismissed pursuant to Penal Code Section 1203.4(a)
                        </p>
                    </div>
                </div>
                
                 <p className="text-sm text-muted-foreground mt-6 text-center">
                    Criminal convictions from another State or Federal court are considered the same as criminal convictions in California.
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
                    
                    <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>YOUR NAME (print clearly):</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="address" render={({ field }) => ( <FormItem className="md:col-span-3"><FormLabel>Street Address:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="ssn" render={({ field }) => ( <FormItem><FormLabel>SOCIAL SECURITY NUMBER:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="driversLicenseNumber" render={({ field }) => ( <FormItem><FormLabel>DRIVER’S LICENSE NUMBER/STATE:</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField
                            control={form.control}
                            name="dob"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>DATE OF BIRTH:</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar 
                                                mode="single" 
                                                selected={field.value} 
                                                onSelect={field.onChange} 
                                                captionLayout="dropdown-buttons"
                                                fromYear={1930}
                                                toYear={new Date().getFullYear() - 18}
                                                initialFocus 
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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

                <Separator />
                
                <div className="space-y-2 text-xs text-muted-foreground pt-4">
                    <p className="font-bold">Instructions to Licensees:</p>
                    <p>If the person discloses that they have ever been convicted of a crime, maintain this form in your facility/organization personnel file and send a copy to your Licensed Program Analyst (LPA) or assigned analyst.</p>
                    <p className="font-bold mt-2">Instructions to Regional Offices and Foster Family Agencies:</p>
                    <p>If ‘Yes’ is indicated in any box above, forward a copy of this completed form (and the LIC 198B, as applicable) to the Caregiver Background Check Bureau, 744 P Street, MS T9-15-62, Sacramento, CA 95814.</p>
                    <p>If ‘No’ is indicated above in all boxes, keep this completed form in the facility file.</p>
                </div>
                
                <Separator />

                <div className="space-y-4 pt-4 text-sm">
                    <h3 className="text-center font-bold">Privacy Notice</h3>
                    <p className="text-center text-xs">As Required by Civil Code § 1798.17</p>
                    <div className="space-y-2 text-muted-foreground">
                        <p className="font-bold">Collection and Use of Personal Information.</p>
                        <p>The California Justice Information Services (CJIS) Division in the Department of Justice (DOJ) collects the information requested on this form as authorized by Penal Code sections 11100-11112; Health and Safety Code sections 1522, 1569.10-1569.24, 1596.80-1596.879; Family Code sections 8700-87200; Welfare and Institutions Code sections 16500-16523.1; and other various state statutes and regulations. The CJIS Division uses this information to process requests of authorized entities that want to obtain information as to the existence and content of a record of state or federal convictions to help determine suitability for employment, or volunteer work with children, elderly, or disabled; or for adoption or purposes of a license, certification, or permit. In addition, any personal information collected by state agencies is subject to the limitations in the Information Practices Act and state policy. The DOJ’s general privacy policy is available at http://oag.ca.gov/privacy-policy.</p>

                        <p className="font-bold">Providing Personal Information.</p>
                        <p>All the personal information requested in the form must be provided. Failure to provide all the necessary information will result in delays and/or the rejection of your request. Notice is given for the request of the Social Security Number (SSN) on this form. The California Department of Justice uses a person’s SSN as an identifying number. The requested SSN is voluntary. Failure to provide the SSN may delay the processing of this form and the criminal record check.</p>
                        
                        <p className="font-bold">Access to Your Information.</p>
                        <p>You may review the records maintained by the CJIS Division in the DOJ that contain your personal information, as permitted by the Information Practices Act. See below for contact information.</p>
                        
                        <p className="font-bold">Possible Disclosure of Personal Information.</p>
                        <p>In order to be licensed, work at, or be present at, a licensed facility/organization, or be placed on a registry administered by the Department, the law requires that you complete a criminal background check. (Health and Safety Code sections 1522, 1568.09, 1569.17 and 1596.871). The Department will create a file concerning your criminal background check that will contain certain documents, including personal information that you provide. You have the right to access certain records containing your personal information maintained by the Department (Civil Code section 1798 et seq.). Under the California Public Records Act (Government Code section 6250 et seq.), the Department may have to provide copies of some of the records in the file to members of the public who ask for them, including newspaper and television reporters.</p>
                        
                        <div className="border p-2 rounded-md bg-muted/50">
                            <p className="font-bold">NOTE: IMPORTANT INFORMATION</p>
                            <p>The Department is required to tell people who ask, including the press, if someone in a licensed facility/ organization has a criminal record exemption. The Department must also tell people who ask the name of a licensed facility/organization that has a licensee, employee, resident, or other person with a criminal record exemption. This does not apply to Resource Family Homes, Small Family Child Care Homes, or the Home Care Aide Registry. The Department shall not release any information regarding Home Care Aides in response to a Public Records Act request, other than their Home Care Aide number.</p>
                        </div>
                        
                        <p>The information you provide may also be disclosed in the following circumstances:</p>
                        <ul className="list-disc pl-5">
                            <li>With other persons or agencies where necessary to perform their legal duties, and their use of your information is compatible and complies with state law, such as for investigations or for licensing, certification, or regulatory purposes.</li>
                            <li>To another government agency as required by state or federal law.</li>
                        </ul>
                    </div>
                </div>

                <Separator />
                <div className="space-y-4 pt-4 text-sm">
                    <h3 className="text-center font-bold">Contact Information</h3>
                    <p className="text-muted-foreground">For questions about this notice, CDSS programs, and the authorized use of your criminal history information, please contact your local licensing regional office.</p>
                    <p className="text-muted-foreground">For further questions about this notice or your criminal records, you may contact the Associate Governmental Program Analyst at the DOJ’s Keeper of Records at (916) 210-3310, by email at keeperofrecords@doj.ca.gov, or by mail at:</p>
                    <p className="pl-4 text-muted-foreground">
                        Department of Justice<br />
                        Bureau of Criminal Information & Analysis Keeper of Records<br />
                        P.O. Box 903417<br />
                        Sacramento, CA 94203-4170
                    </p>

                    <h3 className="font-bold pt-4">Applicant Notification and Record Challenge</h3>
                    <p className="text-muted-foreground">Your fingerprints will be used to check the criminal history records of the FBI. You have the opportunity to complete or challenge the accuracy of the information contained in the FBI identification record. The procedure
for obtaining a change, correction, or updating an FBI identification record are set forth in Title 28, CFR, 16.34.
You can find additional information on the FBI website at https://www.fbi.gov/aboutus/cjis/background-checks.</p>

                    <h3 className="font-bold pt-4">Federal Privacy Act Statement</h3>
                    <p className="text-muted-foreground"><span className="font-semibold">Authority:</span> The FBI’s acquisition, preservation, and exchange of fingerprints and associated information is generally authorized under 28 U.S.C. 534. Depending on the nature of your application, supplemental authorities include Federal statutes, State statutes pursuant to Pub. L. 92-544, Presidential Executive Orders, and federal regulations. Providing your fingerprints and associated information is voluntary; however, failure to
do so may affect completion or approval of your application.</p>
                    <p className="text-muted-foreground"><span className="font-semibold">Principal Purpose:</span> Certain determinations, such as employment, licensing, and security clearances, may be
predicated on fingerprint-based background checks. Your fingerprints and associated information/biometrics
may be provided to the employing, investigating, or otherwise responsible agency, and/or the FBI for the
purpose of comparing your fingerprints to other fingerprints in the FBI’s Next Generation Identification (NGI)
system or its successor systems (including civil, criminal, and latent fingerprint repositories) or other available
records of the employing, investigating, or otherwise responsible agency. The FBI may retain your fingerprints
and associated information/biometrics in NGI after the completion of this application and, while retained, your
fingerprints may continue to be compared against other fingerprints submitted to or retained by NGI.</p>
                    <p className="text-muted-foreground"><span className="font-semibold">Routine Uses:</span> During the processing of this application and for as long thereafter as your fingerprints and
associated information/biometrics are retained in NGI, your information may be disclosed pursuant to your
consent, and may be disclosed without your consent as permitted by the Privacy Act of 1974 and all applicable
Routine Uses as may be published at any time in the Federal Register, including the Routine Uses for the
NGI system and the FBI’s Blanket Routine Uses. Routine uses include, but are not limited to, disclosures to:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
                        <li>employing, governmental or authorized non-governmental agencies responsible for employment, contracting,
licensing, security clearances, and other suitability determinations;</li>
                        <li>local, state, tribal, or federal law enforcement agencies; criminal justice agencies; and agencies responsible for national security or public safety.</li>
                    </ul>

                    <h3 className="font-bold pt-4">Noncriminal Justice Applicant’s Privacy Rights</h3>
                    <p className="text-muted-foreground">As an applicant who is the subject of a national fingerprint-based criminal history record check for a
noncriminal justice purpose (such as an application for employment or a license, an immigration or
naturalization matter, security clearance, or adoption), you have certain rights which are discussed below.</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
                        <li>You must be provided written notification¹ that your fingerprints will be used to check the criminal history records of the FBI.</li>
                        <li>You must be provided, and acknowledge receipt of, an adequate Privacy Act Statement when you submit your fingerprints and associated personal information. This Privacy Act Statement should explain the authority for collecting your information and how your information will be used, retained, and shared.²</li>
                        <li>If you have a criminal history record, the officials making a determination of your suitability for the employment, license, or other benefit must provide you the opportunity to complete or challenge the accuracy of the information in the record.</li>
                        <li>The officials must advise you that the procedures for obtaining a change, correction, or update of your criminal history record are set forth at Title 28, Code of Federal Regulations (CFR), Section 16.34.</li>
                        <li>If you have a criminal history record, you should be afforded a reasonable amount of time to correct or complete the record (or decline to do so) before the officials deny you the employment, license, or other benefit based on information in the criminal history record.³</li>
                        <li>You have the right to expect that officials receiving the results of the criminal history record check will use it only for authorized purposes and will not retain or disseminate it in violation of federal statute, regulation or executive order, or rule, procedure or standard established by the National Crime Prevention and Privacy Compact Council.⁴</li>
                    </ul>
                    <p className="text-muted-foreground pt-2">If agency policy permits, the officials may provide you with a copy of your FBI criminal history record for review and possible challenge. If agency policy does not permit it to provide you a copy of the record, you may obtain a copy of the record by submitting fingerprints and a fee to the FBI. Information regarding this process may be obtained at https://www.fbi.gov/services/cjis/identity-history-summary-checks.</p>
                    <p className="text-muted-foreground pt-2">If you decide to challenge the accuracy or completeness of your FBI criminal history record, you should send your challenge to the agency that contributed the questioned information to the FBI. Alternatively, you may send your challenge directly to the FBI. The FBI will then forward your challenge to the agency that contributed the questioned information and request the agency to verify or correct the challenged entry. Upon receipt of an official communication from that agency, the FBI will make any necessary changes/corrections to your record in accordance with the information supplied by that agency. (See 28 CFR 16.30 through 16.34.) You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks.</p>

                    <Separator className="my-4"/>

                    <div className="text-xs text-muted-foreground space-y-1">
                        <p>¹ Written notification includes electronic notification, but excludes oral notification.</p>
                        <p>² https://www.fbi.gov/services/cjis/compact-council/privacy-act-statement</p>
                        <p>³ See 28 CFR 50.12(b)</p>
                        <p>⁴ See U.S.C. 552a(b); 28 U.S.C. 534(b); 34 U.S.C. § 40316 (formerly cited as 42 U.S.C. § 14616), Article IV(c)</p>
                    </div>
                </div>


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

    