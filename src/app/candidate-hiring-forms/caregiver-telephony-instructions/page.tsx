
"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { doc } from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, X, Loader2 } from "lucide-react";
import { useUser, useDoc, useMemoFirebase, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { type CaregiverProfile, type CaregiverEmployee } from "@/lib/types";
import { saveTelephonyInstructionsData } from "@/lib/candidate-hiring-forms.actions";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/TeleTrackLogo.png?alt=media&token=bb364313-385d-46da-9252-87074edda322";

export default function CaregiverTelephonyInstructionsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const firestore = useFirestore();

    const isPrintMode = searchParams.get('print') === 'true';
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

    const employeeRecordRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_employees', profileIdToLoad) : null),
      [profileIdToLoad, firestore]
    );
    const { data: employeeData, isLoading: isEmployeeLoading } = useDoc<CaregiverEmployee>(employeeRecordRef);
    
    const profileRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
      [profileIdToLoad, firestore]
    );
    const { data: profileData, isLoading: isProfileLoading } = useDoc<CaregiverProfile>(profileRef);

    const handleAcknowledge = () => {
      if (!profileIdToLoad) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveTelephonyInstructionsData(profileIdToLoad);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your Telephony Instructions have been acknowledged."});
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

    const isLoading = isUserLoading || isEmployeeLoading || isProfileLoading;

    if(isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className={cn("max-w-2xl mx-auto", isPrintMode && "border-none shadow-none")}>
            <CardHeader>
                <div className="flex items-start gap-4">
                    <Image src={logoUrl} alt="TeleTrack Logo" width={60} height={60} className="object-contain" />
                    <CardTitle className="text-xl tracking-wide pt-4">TeleTrack Telephony Instructions</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <ul className="list-disc list-inside space-y-4 text-sm text-muted-foreground">
                    <li><strong>Step 1</strong> From the Clients Telephone call the Clock In number. <strong>866-425-8463</strong></li>
                    <li><strong>Step 2</strong> Input your 4-digit TeleTrack ID Number <strong className="font-mono bg-muted px-2 py-1 rounded">{employeeData?.teletrackPin || '____'}</strong> (provided by your oﬃce)</li>
                    <li><strong>Step 3</strong> Input your work status:
                        <ul className="list-[circle] list-inside pl-4">
                            <li>Press <strong>1</strong>, for arrival and then hang up</li>
                            <li>Press <strong>2</strong>, for departure and then go to Step 4</li>
                        </ul>
                    </li>
                    <li><strong>Step 4</strong> Entering Activity Codes – Only prompted when departing. <strong>N/A</strong> To enter Activity Codes enter the 3-digit code associated with the task you completed and press #, the system will prompt you to enter your next Activity Code. When you have entered all Activity Codes for task completed during this visit press * then #. This will give you confirmation of a successful departure.
                        <p className="mt-2">Activity Codes (provided by your oﬃce)</p>
                        <div className="border-t border-dashed border-muted-foreground my-4 h-[250px]"></div>
                    </li>
                </ul>
                <div className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                       <div className="space-y-2">
                            <Label>Employee's Name</Label>
                            <Input value={profileData?.fullName || ''} readOnly disabled />
                       </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className={cn("flex justify-end gap-4", isPrintMode && "no-print")}>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleAcknowledge} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                  Acknowledge and Save
                </Button>
            </CardFooter>
        </Card>
    );
}
