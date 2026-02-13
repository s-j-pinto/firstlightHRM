
'use client';

import { Suspense, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Loader2, ArrowLeft, Printer } from "lucide-react";
import Link from 'next/link';
import { useUser, useDoc, useMemoFirebase, firestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CaregiverProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { generateHcs501PdfAction, generateEmergencyContactPdfAction, generateReferenceVerificationPdfAction, generateLic508PdfAction, generateSoc341aPdfAction } from '@/lib/candidate-hiring-forms.actions';
import { useToast } from '@/hooks/use-toast';

const hiringForms = [
  { name: "HCS 501 - Personnel Record 2019", href: "/candidate-hiring-forms/hcs501", completionKey: 'hcs501EmployeeSignature', pdfAction: 'hcs501' },
  { name: "Caregiver Emergency Contact Numbers", href: "/candidate-hiring-forms/emergency-contact", completionKey: 'emergencyContact1_name', pdfAction: 'emergencyContact' },
  { name: "Reference Verification - CG", href: "/candidate-hiring-forms/reference-verification", completionKey: 'applicantSignature', pdfAction: 'referenceVerification' },
  { name: "LIC 508 - Criminal Record Statement", href: "/candidate-hiring-forms/lic508", completionKey: 'lic508Signature', pdfAction: 'lic508' },
  { name: "SOC 341A - Elder Abuse Reporting Form", href: "/candidate-hiring-forms/soc341a", completionKey: 'soc341aSignature', pdfAction: 'soc341a' },
];


function CandidateHiringFormsContent() {
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
  const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
  const [isGeneratingPdf, startPdfGeneration] = useTransition();

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
  
  const handleGeneratePdf = (formAction: string) => {
    if (!candidateId) return;

    startPdfGeneration(async () => {
        let result: { pdfData?: string; error?: string } | undefined;
        if (formAction === 'hcs501') {
            result = await generateHcs501PdfAction(candidateId);
        } else if (formAction === 'emergencyContact') {
            result = await generateEmergencyContactPdfAction(candidateId);
        } else if (formAction === 'referenceVerification') {
            result = await generateReferenceVerificationPdfAction(candidateId);
        } else if (formAction === 'lic508') {
            result = await generateLic508PdfAction(candidateId);
        } else if (formAction === 'soc341a') {
            result = await generateSoc341aPdfAction(candidateId);
        } else {
             toast({ title: 'PDF Generation Not Implemented', description: `No PDF generator exists for this form yet.`, variant: 'destructive' });
             return;
        }

        if (result && result.error) {
            toast({ title: 'PDF Generation Failed', description: result.error, variant: 'destructive' });
        } else if (result && result.pdfData) {
            const byteCharacters = atob(result.pdfData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        }
    });
  }


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
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Hiring Forms{isAnAdmin && profileData ? ` for ${profileData.fullName}` : ''}</CardTitle>
              <CardDescription>
                {isAnAdmin ? 'Review the status of the candidate\'s forms below.' : 'Please complete all of the following forms to continue your onboarding process.'}
              </CardDescription>
            </div>
            {isAnAdmin && (
              <Button asChild variant="outline">
                <Link href="/admin/advanced-search">
                  <ArrowLeft className="mr-2" />
                  Back to Admin Dashboard
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hiringForms.map((form) => {
            const isCompleted = profileData && profileData[form.completionKey as keyof CaregiverProfile];
            return (
              <div key={form.name} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <Link href={formLinkHref(form.href)} className="flex items-center gap-4 flex-grow">
                  <FileText className="h-6 w-6 text-accent" />
                  <span className="font-medium">{form.name}</span>
                </Link>
                 <div className="flex items-center gap-2">
                    {isCompleted && <CheckCircle className="h-6 w-6 text-green-500" />}
                    {isAnAdmin && isCompleted && (
                       form.pdfAction ? (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleGeneratePdf(form.pdfAction!)}
                                disabled={isGeneratingPdf}
                            >
                                {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                <span className="sr-only">Generate PDF</span>
                            </Button>
                        ) : (
                            <Button asChild variant="outline" size="icon">
                            <Link href={`${form.href}?candidateId=${candidateId}&print=true`} target="_blank">
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">Print or Generate PDF</span>
                            </Link>
                            </Button>
                        )
                    )}
                </div>
              </div>
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

    