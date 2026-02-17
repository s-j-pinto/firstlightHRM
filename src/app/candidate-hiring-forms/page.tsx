

'use client';

import { Suspense, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Loader2, ArrowLeft, Printer } from "lucide-react";
import Link from 'next/link';
import { useUser, useDoc, useMemoFirebase, firestore, useCollection } from '@/firebase';
import { doc, query, where, collection, limit } from 'firebase/firestore';
import type { CaregiverProfile, Interview } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { 
    generateHcs501PdfAction, 
    generateEmergencyContactPdfAction, 
    generateLic508PdfAction, 
    generateSoc341aPdfAction, 
    generateHcaJobDescriptionPdfAction, 
    generateDrugAlcoholPolicyPdfAction, 
    generateClientAbandonmentPdfAction, 
    generateArbitrationAgreementPdfAction, 
    generateEmployeeOrientationAgreementPdfAction, 
    generateAcknowledgmentFormPdfAction, 
    generateConfidentialityAgreementPdfAction, 
    generateTrainingAcknowledgementPdfAction, 
    generateOfferLetterPdfAction,
    generateReferenceVerification1PdfAction,
    generateReferenceVerification2PdfAction
} from '@/lib/candidate-hiring-forms.actions';
import { useToast } from '@/hooks/use-toast';
import { HelpDialog } from '@/components/HelpDialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const hiringForms = [
  { name: "HCS 501 - Personnel Record 2019", href: "/candidate-hiring-forms/hcs501", completionKey: 'hcs501EmployeeSignature', pdfAction: 'hcs501' },
  { name: "Caregiver Emergency Contact Numbers", href: "/candidate-hiring-forms/emergency-contact", completionKey: 'emergencyContact1_name', pdfAction: 'emergencyContact' },
  { name: "Reference Verification 1", href: "/candidate-hiring-forms/reference-verification-1", completionKey: 'applicantSignature1', pdfAction: 'referenceVerification1' },
  { name: "Reference Verification 2", href: "/candidate-hiring-forms/reference-verification-2", completionKey: 'applicantSignature2', pdfAction: 'referenceVerification2' },
  { name: "LIC 508 - Criminal Record Statement", href: "/candidate-hiring-forms/lic508", completionKey: 'lic508Signature', pdfAction: 'lic508' },
  { name: "SOC 341A - Elder Abuse Reporting Form", href: "/candidate-hiring-forms/soc341a", completionKey: 'soc341aSignature', pdfAction: 'soc341a' },
];

const onboardingForms = [
  { name: "Mutual Arbitration Agreement", href: "/candidate-hiring-forms/arbitration-agreement", completionKey: 'arbitrationAgreementSignature', pdfAction: 'arbitrationAgreement' },
  { name: "Drug and/or Alcohol Testing Consent Form", href: "/candidate-hiring-forms/drug-alcohol-policy", completionKey: 'drugAlcoholPolicySignature', pdfAction: 'drugAlcoholPolicy' },
  { name: "HCA job description-Rancho-Cucamonga", href: "/candidate-hiring-forms/hca-job-description", completionKey: 'jobDescriptionSignature', pdfAction: 'hcaJobDescription' },
  { name: "Client Abandonment", href: "/candidate-hiring-forms/client-abandonment", completionKey: 'clientAbandonmentSignature', pdfAction: 'clientAbandonment' },
  { name: "EMPLOYEE ORIENTATION AGREEMENT", href: "/candidate-hiring-forms/employee-orientation-agreement", completionKey: 'orientationAgreementSignature', pdfAction: 'employeeOrientationAgreement' },
  { name: "FirstLightHomeCare_AcknowledgmentForm", href: "/candidate-hiring-forms/acknowledgment-form", completionKey: 'acknowledgmentSignature', pdfAction: 'acknowledgmentForm' },
  { name: "FirstLightHomeCare_CONFIDENTIALITY_AGREEMENT", href: "/candidate-hiring-forms/confidentiality-agreement", completionKey: 'confidentialityAgreementEmployeeSignature', pdfAction: 'confidentialityAgreement' },
  { name: "FirstLightHomeCareTrainingAcknowledgement", href: "/candidate-hiring-forms/training-acknowledgement", completionKey: 'trainingAcknowledgementSignature', pdfAction: 'trainingAcknowledgement' },
  { name: "MASTER-FLHC Offer Letter revised-2-16-26", href: "/candidate-hiring-forms/offer-letter", completionKey: 'offerLetterSignature', pdfAction: 'offerLetter' },
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
  
  const interviewQuery = useMemoFirebase(
    () => (profileIdToLoad ? query(collection(firestore, 'interviews'), where('caregiverProfileId', '==', profileIdToLoad), limit(1)) : null),
    [profileIdToLoad]
  );
  const { data: interviewData, isLoading: isInterviewLoading } = useCollection<Interview>(interviewQuery);
  const interview = interviewData?.[0];

  const isLoading = isUserLoading || isProfileLoading || isInterviewLoading;

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
        } else if (formAction === 'referenceVerification1') {
            result = await generateReferenceVerification1PdfAction(candidateId);
        } else if (formAction === 'referenceVerification2') {
            result = await generateReferenceVerification2PdfAction(candidateId);
        } else if (formAction === 'lic508') {
            result = await generateLic508PdfAction(candidateId);
        } else if (formAction === 'soc341a') {
            result = await generateSoc341aPdfAction(candidateId);
        } else if (formAction === 'hcaJobDescription') {
            result = await generateHcaJobDescriptionPdfAction(candidateId);
        } else if (formAction === 'drugAlcoholPolicy') {
            result = await generateDrugAlcoholPolicyPdfAction(candidateId);
        } else if (formAction === 'clientAbandonment') {
            result = await generateClientAbandonmentPdfAction(candidateId);
        } else if (formAction === 'arbitrationAgreement') {
            result = await generateArbitrationAgreementPdfAction(candidateId);
        } else if (formAction === 'employeeOrientationAgreement') {
            result = await generateEmployeeOrientationAgreementPdfAction(candidateId);
        } else if (formAction === 'acknowledgmentForm') {
            result = await generateAcknowledgmentFormPdfAction(candidateId);
        } else if (formAction === 'confidentialityAgreement') {
            result = await generateConfidentialityAgreementPdfAction(candidateId);
        } else if (formAction === 'trainingAcknowledgement') {
            result = await generateTrainingAcknowledgementPdfAction(candidateId);
        } else if (formAction === 'offerLetter') {
            result = await generateOfferLetterPdfAction(candidateId);
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
    <div className="max-w-2xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Hiring Forms{isAnAdmin && profileData ? ` for ${profileData.fullName}` : ''}</CardTitle>
              <CardDescription>
                {isAnAdmin ? 'Review the status of the candidate\'s forms below.' : 'Please complete all of the following forms to continue your onboarding process.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                {isAnAdmin && (
                  <Button asChild variant="outline">
                    <Link href="/admin/advanced-search">
                      <ArrowLeft className="mr-2" />
                      Back to Admin Dashboard
                    </Link>
                  </Button>
                )}
                <HelpDialog topic="candidateHiringForms" />
            </div>
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
                       <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGeneratePdf(form.pdfAction!)}
                            disabled={isGeneratingPdf || !form.pdfAction}
                            title={!form.pdfAction ? "PDF generation not available for this form" : "Generate PDF"}
                        >
                            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            <span>Generate PDF</span>
                        </Button>
                    )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
      
      {interview?.onboardingFormsInitiated && (
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Forms</CardTitle>
            <CardDescription>
              Please complete these additional forms as part of your onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {onboardingForms.map((form) => {
              const isCompleted = profileData && form.completionKey && profileData[form.completionKey as keyof CaregiverProfile];
              const isDisabled = form.href === '#';
              return (
                <div key={form.name} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Link href={isDisabled ? '#' : formLinkHref(form.href)} className={cn("flex items-center gap-4 flex-grow", isDisabled && "cursor-not-allowed opacity-50")}>
                    <FileText className="h-6 w-6 text-accent" />
                    <span className="font-medium">{form.name}</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    {isCompleted && <CheckCircle className="h-6 w-6 text-green-500" />}
                    {isAnAdmin && isCompleted && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGeneratePdf(form.pdfAction!)}
                            disabled={isGeneratingPdf || !form.pdfAction}
                            title={!form.pdfAction ? "PDF generation not available for this form" : "Generate PDF"}
                        >
                            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                            <span>Generate PDF</span>
                        </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
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
