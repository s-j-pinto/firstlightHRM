
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useUser, useDoc, useMemoFirebase, firestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CaregiverProfile } from '@/lib/types';

const hiringForms = [
  { name: "HCS 501 - Personnel Record 2019", href: "/candidate-hiring-forms/hcs501", completionKey: 'hcs501EmployeeSignature' },
  { name: "Caregiver Emergency Contact Numbers", href: "/candidate-hiring-forms/emergency-contact", completionKey: 'emergencyContact1_name' },
  { name: "Reference Verification - CG", href: "/candidate-hiring-forms/reference-verification", completionKey: 'applicantSignature' },
  { name: "LIC 508 - Criminal Record Statement", href: "/candidate-hiring-forms/lic508", completionKey: 'lic508Signature' },
  { name: "SOC 341A - Elder Abuse Reporting Form", href: "/candidate-hiring-forms/soc341a", completionKey: 'soc341aSignature' },
];

export default function CandidateHiringFormsPage() {
  const { user, isUserLoading } = useUser();
  const caregiverProfileRef = useMemoFirebase(
    () => (user?.uid ? doc(firestore, 'caregiver_profiles', user.uid) : null),
    [user?.uid]
  );
  const { data: profileData, isLoading: isProfileLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Hiring Forms</CardTitle>
          <CardDescription>
            Please complete all of the following forms to continue your onboarding process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hiringForms.map((form) => {
            const isCompleted = profileData && profileData[form.completionKey as keyof CaregiverProfile];
            return (
              <Link href={form.href} key={form.name} className="block">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <FileText className="h-6 w-6 text-accent" />
                    <span className="font-medium">{form.name}</span>
                  </div>
                  {isCompleted && <CheckCircle className="h-6 w-6 text-green-500" />}
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  );
}
