
"use client";

import { useRef, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import SignatureCanvas from 'react-signature-canvas';
import { doc } from "firebase/firestore";
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RefreshCw, Save, X, Loader2, CalendarIcon } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { soc341aSchema, type Soc341aFormData, type CaregiverProfile } from "@/lib/types";
import { saveSoc341aData } from "@/lib/candidate-hiring-forms.actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const defaultFormValues: Soc341aFormData = {
  soc341aSignature: '',
  soc341aSignatureDate: undefined,
};

export default function SOC341APage() {
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
    
    const form = useForm<Soc341aFormData>({
      resolver: zodResolver(soc341aSchema),
      defaultValues: defaultFormValues,
    });

    useEffect(() => {
        if (existingData) {
            const formData:any = {};
            if(existingData.soc341aSignature) formData.soc341aSignature = existingData.soc341aSignature;
            if (existingData.soc341aSignatureDate && typeof (existingData.soc341aSignatureDate as any).toDate === 'function') {
                formData.soc341aSignatureDate = (existingData.soc341aSignatureDate as any).toDate();
            } else {
                formData.soc341aSignatureDate = undefined;
            }

            form.reset(formData);

             if (formData.soc341aSignature && sigPadRef.current) {
                sigPadRef.current.fromDataURL(formData.soc341aSignature);
            }
        }
    }, [existingData, form]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        form.setValue('soc341aSignature', '');
    };

    const onSubmit = (data: Soc341aFormData) => {
      if (!user?.uid) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveSoc341aData(user.uid, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your SOC 341A form has been saved."});
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
                <CardTitle className="text-center text-xl tracking-wide">
                    STATEMENT ACKNOWLEDGING REQUIREMENT TO REPORT SUSPECTED ABUSE OF DEPENDENT ADULTS AND ELDERS
                </CardTitle>
                 <CardDescription className="text-center pt-2 text-xs">
                    NOTE: RETAIN IN EMPLOYEE/ VOLUNTEER FILE
                </CardDescription>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-3 gap-4 border p-4 rounded-md">
                    <div className="space-y-1">
                        <Label>NAME</Label>
                        <Input value={existingData?.fullName || ''} readOnly disabled />
                    </div>
                    <div className="space-y-1">
                        <Label>POSITION</Label>
                        <Input value="Caregiver" readOnly disabled />
                    </div>
                    <div className="space-y-1">
                        <Label>FACILITY</Label>
                        <Input value="FirstLight Home Care of Rancho Cucamonga" readOnly disabled />
                    </div>
                </div>

                <p className="text-sm text-muted-foreground">
                    California law REQUIRES certain persons to report known or suspected abuse of dependent adults or elders. As an employee or volunteer at a licensed facility, you are one of those persons - a “mandated reporter.”
                </p>

                <div className="space-y-4">
                    <h3 className="font-bold">PERSONS WHO ARE REQUIRED TO REPORT ABUSE</h3>
                    <p className="text-sm text-muted-foreground">
                        Mandated reporters include care custodians and any person who has assumed full or intermittent responsibility for care or custody of an elder or dependent adult, whether or not paid for that responsibility (Welfare and Institutions Code (WIC) Section 15630(a)). Care custodian means an administrator or an employee of most public or private facilities or agencies, or persons providing care or services for elders or dependent adults, including members of the support staff and maintenance staff (WIC Section 15610.17).
                    </p>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold">PERSONS WHO ARE THE SUBJECT OF THE REPORT</h3>
                    <p className="text-sm text-muted-foreground">
                        Elder means any person residing in this state who is 65 years of age or older (WIC Section 15610.27). Dependent Adult means any person residing in this state, between the ages of 18 and 64, who has physical or mental limitations that restrict his or her ability to carry out normal activities or to protect his or her rights including, but not limited to, persons who have physical or developmental disabilities or whose physical or mental abilities have diminished because of age and those admitted as inpatients in 24-hour health facilities (WIC Section 15610.23).
                    </p>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold">REPORTING RESPONSIBILITIES AND TIME FRAMES</h3>
                    <p className="text-sm text-muted-foreground">
                        Any mandated reporter, who in his or her professional capacity, or within the scope of his or her employment, has observed or has knowledge of an incident that reasonably appears to be abuse or neglect, or is told by an elder or dependent adult that he or she has experienced behavior constituting abuse or neglect, or reasonably suspects that abuse or neglect occurred, shall complete form SOC 341, “Report of Suspected Dependent Adult/Elder Abuse” for each report of known or suspected instance of abuse (physical abuse, sexual abuse, financial abuse, abduction, neglect (self-neglect), isolation, and abandonment) involving an elder or dependent adult.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Reporting shall be completed as follows:
                    </p>
                    <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-2">
                        <li>
                            If the abuse occurred in a Long-Term Care (LTC) facility (as defined in WIC Section 15610.47) and resulted in serious bodily injury (as defined in WIC Section 15610.67), report by telephone to the local law enforcement agency immediately and no later than two (2) hours after observing, obtaining knowledge of, or suspecting physical abuse. Send the written report to the local law enforcement agency, the local Long-Term Care Ombudsman Program (LTCOP), and the appropriate licensing agency (for long-term health care facilities, the California Department of Public Health; for community care facilities, the California Department of Social Services) within two (2) hours of observing, obtaining knowledge of, or suspecting physical abuse.
                        </li>
                        <li>
                            If the abuse occurred in a LTC facility, was physical abuse, but did not result in serious bodily injury, report by telephone to the local law enforcement agency within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse. Send the written report to the local law enforcement agency, the local LTCOP, and the appropriate licensing agency (for long-term health care facilities, the California Department of Public Health; for community care facilities, the California Department of Social Services) within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse.
                        </li>
                        <li>
                            If the abuse occurred in a LTC facility, was physical abuse, did not result in serious bodily injury, and was perpetrated by a resident with a physician's diagnosis of dementia, report by telephone to the local law enforcement agency or the local LTCOP, immediately or as soon as practicably possible. Follow by sending the written report to the LTCOP or the local law enforcement agency within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse.
                        </li>
                        <li>
                            If the abuse occurred in a LTC facility, and was abuse other than physical abuse, report by telephone to the LTCOP or the law enforcement agency immediately or as soon as practicably possible. Follow by sending the written report to the local law enforcement agency or the LTCOP within two working days.
                        </li>
                        <li>
                            If the abuse occurred in a state mental hospital or a state developmental center, mandated reporters shall report by telephone or through a confidential internet reporting tool (established in WIC Section 15658) immediately or as soon as practicably possible and submit the report within two (2) working days of making the telephone report to the responsible agency as identified below:
                            <ul className="list-['•'] pl-6 mt-2 space-y-1">
                                <li>If the abuse occurred in a State Mental Hospital, report to the local law enforcement agency or the California Department of State Hospitals.</li>
                                <li>If the abuse occurred in a State Developmental Center, report to the local law enforcement agency or to the California Department of Developmental Services.</li>
                            </ul>
                        </li>
                        <li>
                            For all other abuse, mandated reporters shall report by telephone or through a confidential internet reporting tool to the adult protective services agency or the local law enforcement agency immediately or as soon as practicably possible. If reported by telephone, a written or an Internet report shall be sent to adult protective services or law enforcement within two working days.
                        </li>
                    </ul>
                </div>
                 <div className="space-y-4">
                    <h3 className="font-bold">PENALTY FOR FAILURE TO REPORT ABUSE</h3>
                    <p className="text-sm text-muted-foreground">
                        Failure to report abuse of an elder or dependent adult is a MISDEMEANOR CRIME, punishable by jail time, fine or both (WIC Section 15630(h)). The reporting duties are individual, and no supervisor or administrator shall impede or inhibit the reporting duties, and no person making the report shall be subject to any sanction for making the report (WIC Section 15630(f)).
                    </p>
                </div>
                 <div className="space-y-4">
                    <h3 className="font-bold">CONFIDENTIALITY OF REPORTER AND OF ABUSE REPORTS</h3>
                    <p className="text-sm text-muted-foreground">
                        The identity of all persons who report under WIC Chapter 11 shall be confidential and disclosed only
                    </p>
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
