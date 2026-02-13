
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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


function CandidateHiringFormsContent() {
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
  const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";

  const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
  const candidateId = searchParams.get('candidateId');
  
  // Correctly determine which profile to load
  const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

  const caregiverProfileRef = useMemoFirebase(
    () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
    [profileIdToLoad]
  );
  const { data: profileData, isLoading: isProfileLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

  const isLoading = isUserLoading || isProfileLoading;

  const formLinkHref = (baseHref: string) => {
    return isAnAdmin && candidateId ? `${baseHref}?candidateId=${candidateId}` : baseHref;
  };

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
          <CardTitle>Hiring Forms{isAnAdmin && profileData ? ` for ${profileData.fullName}` : ''}</CardTitle>
          <CardDescription>
            {isAnAdmin ? 'Review the status of the candidate\'s forms below.' : 'Please complete all of the following forms to continue your onboarding process.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hiringForms.map((form) => {
            const isCompleted = profileData && profileData[form.completionKey as keyof CaregiverProfile];
            return (
              <Link href={formLinkHref(form.href)} key={form.name} className="block">
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


export default function CandidateHiringFormsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>}>
            <CandidateHiringFormsContent />
        </Suspense>
    )
}
