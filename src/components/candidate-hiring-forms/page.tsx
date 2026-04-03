

'use client';

import { Suspense, useTransition, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Loader2, ArrowLeft, Printer, Download, XCircle, Bell, BellOff, Edit2, FileCheck2, FileClock } from "lucide-react";
import Link from 'next/link';
import { useUser, useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, query, where, collection, limit } from 'firebase/firestore';
import type { CaregiverProfile, Interview, OnboardingSignatures } from '@/lib/types';
import { 
    hcs501AdminSchema,
    drugAlcoholPolicyAdminSchema,
    clientAbandonmentAdminSchema,
    employeeOrientationAgreementAdminSchema
} from '@/lib/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { 
    generateHcs501PdfAction, 
    generateEmergencyContactPdfAction, 
    generateReferenceVerification1PdfAction,
    generateReferenceVerification2PdfAction,
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
    generateCaregiverResponsibilitiesPdfAction,
    generateLightHousekeepingPdfAction,
    generateCaregiverTelephonyInstructionsPdfAction,
    generateEmergencyProcedurePdfAction,
    generateAllFormsAsZipAction
} from '@/lib/candidate-hiring-forms.actions';
import { useToast } from '@/hooks/use-toast';
import { HelpDialog } from '@/components/HelpDialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format, isDate } from 'date-fns';
import { sendHiringDocsNotification } from '@/lib/communication.actions';

const hiringForms: { name: string; href: string; completionKey: keyof CaregiverProfile | keyof OnboardingSignatures; pdfAction: string; adminSchema?: z.ZodObject<any, any, any> | z.ZodEffects<any,any,any> }[] = [
  { name: "HCS 501 - Personnel Record 2019", href: "/candidate-hiring-forms/hcs501", completionKey: 'hcs501EmployeeSignature', pdfAction: 'hcs501', adminSchema: hcs501AdminSchema },
  { name: "Caregiver Emergency Contact Numbers", href: "/candidate-hiring-forms/emergency-contact", completionKey: 'emergencyContact1_name', pdfAction: 'emergencyContact' },
  { name: "Reference Verification 1", href: "/candidate-hiring-forms/reference-verification-1", completionKey: 'applicantSignature1', pdfAction: 'referenceVerification1' },
  { name: "Reference Verification 2", href: "/candidate-hiring-forms/reference-verification-2", completionKey: 'applicantSignature2', pdfAction: 'referenceVerification2' },
  { name: "LIC 508 - Criminal Record Statement", href: "/candidate-hiring-forms/lic508", completionKey: 'lic508Signature', pdfAction: 'lic508' },
  { name: "SOC 341A - Elder Abuse Reporting Form", href: "/candidate-hiring-forms/soc341a", completionKey: 'soc341aSignature', pdfAction: 'soc341a' },
];

const onboardingForms: { name: string; href: string; completionKey: keyof CaregiverProfile | keyof OnboardingSignatures; pdfAction: string; adminSchema?: z.ZodObject<any, any, any> | z.ZodEffects<any,any,any> }[] = [
  { name: "Mutual Arbitration Agreement", href: "/candidate-hiring-forms/arbitration-agreement", completionKey: 'arbitrationAgreementSignature', pdfAction: 'arbitrationAgreement' },
  { name: "Drug and/or Alcohol Testing Consent Form", href: "/candidate-hiring-forms/drug-alcohol-policy", completionKey: 'drugAlcoholPolicySignature', pdfAction: 'drugAlcoholPolicy', adminSchema: drugAlcoholPolicyAdminSchema },
  { name: "HCA job description-Rancho-Cucamonga", href: "/candidate-hiring-forms/hca-job-description", completionKey: 'jobDescriptionSignature', pdfAction: 'hcaJobDescription' },
  { name: "Client Abandonment", href: "/candidate-hiring-forms/client-abandonment", completionKey: 'clientAbandonmentSignature', pdfAction: 'clientAbandonment' },
  { name: "EMPLOYEE ORIENTATION AGREEMENT", href: "/candidate-hiring-forms/employee-orientation-agreement", completionKey: 'orientationAgreementSignature', pdfAction: 'employeeOrientationAgreement', adminSchema: employeeOrientationAgreementAdminSchema },
  { name: "FirstLightHomeCare_AcknowledgmentForm", href: "/candidate-hiring-forms/acknowledgment-form", completionKey: 'acknowledgmentSignature', pdfAction: 'acknowledgmentForm' },
  { 
    name: "FirstLightHomeCare_CONFIDENTIALITY_AGREEMENT", 
    href: "/candidate-hiring-forms/confidentiality-agreement", 
    completionKey: 'confidentialityAgreementEmployeeSignature', 
    pdfAction: 'confidentialityAgreement'
  },
  { name: "FirstLightHomeCareTrainingAcknowledgement", href: "/candidate-hiring-forms/training-acknowledgement", completionKey: 'trainingAcknowledgementSignature', pdfAction: 'trainingAcknowledgement' },
  { name: "MASTER-FLHC Offer Letter revised-2-16-26", href: "/candidate-hiring-forms/offer-letter", completionKey: 'offerLetterSignature', pdfAction: 'offerLetter' },
  { name: "Caregiver Responsibilities", href: "/candidate-hiring-forms/caregiver-responsibilities", completionKey: 'caregiverResponsibilitiesSignature', pdfAction: 'caregiverResponsibilities' },
  { name: "Light Housekeeping", href: "/candidate-hiring-forms/light-housekeeping", completionKey: 'lightHousekeepingAcknowledged', pdfAction: 'lightHousekeeping' },
  { name: "Caregiver Telephony Instructions", href: "/candidate-hiring-forms/caregiver-telephony-instructions", completionKey: 'telephonyInstructionsAcknowledged', pdfAction: 'caregiverTelephonyInstructions' },
  { name: "Caregiver Emergency Procedures", href: "/candidate-hiring-forms/emergency-procedure", completionKey: 'emergencyProcedureSignature', pdfAction: 'emergencyProcedure' },
];


function CandidateHiringFormsContent() {
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
  const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
  const [isGeneratingPdf, startPdfGeneration] = useTransition();
  const [isDownloadingAll, startDownloadingAll] = useTransition();
  const [isVerified, setIsVerified] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();


  const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;
  const candidateId = searchParams.get('candidateId');
  
  const profileIdToLoad = isAnAdmin && candidateId ? candidateId : user?.uid;

  const caregiverProfileRef = useMemoFirebase(
    () => (profileIdToLoad && firestore ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
    [profileIdToLoad, firestore]
  );
  const { data: profileData, isLoading: isProfileLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);
  
  const signaturesRef = useMemoFirebase(
    () => (profileIdToLoad && firestore ? doc(firestore, `caregiver_profiles/${profileIdToLoad}/signatures`, 'onboarding_main') : null),
    [profileIdToLoad, firestore]
  );
  const { data: signaturesData, isLoading: isSignaturesLoading } = useDoc<OnboardingSignatures>(signaturesRef);
  
  const interviewQuery = useMemoFirebase(
    () => (profileIdToLoad && firestore ? query(collection(firestore, 'interviews'), where('caregiverProfileId', '==', profileIdToLoad), limit(1)) : null),
    [profileIdToLoad, firestore]
  );
  const { data: interviewData, isLoading: isInterviewLoading } = useCollection<Interview>(interviewQuery);
  const interview = interviewData?.[0];

  const isLoading = isUserLoading || isProfileLoading || isInterviewLoading || isSignaturesLoading;
  
  const allAvailableForms = interview?.onboardingFormsInitiated ? [...hiringForms, ...onboardingForms] : hiringForms;

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
  
  const formCompletionStates = useMemo(() => {
    if (!profileData) {
      return { allCandidateFormsComplete: false, allAdminFieldsComplete: false, formsToRender: [] };
    }

    const sanitizedProfileData: { [key: string]: any } = { ...profileData, ...signaturesData };
    
    // Sanitize all date-like fields to strings for validation, once.
    for (const key in sanitizedProfileData) {
        if (Object.prototype.hasOwnProperty.call(sanitizedProfileData, key)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('date') || lowerKey.endsWith('at') || lowerKey === 'dob') {
                const value = sanitizedProfileData[key];
                if (value) {
                    const date = safeToDate(value);
                    if(date) {
                        sanitizedProfileData[key] = format(date, 'MM/dd/yyyy');
                    }
                }
            }
        }
    }

    const formsWithStatus = allAvailableForms.map(form => {
      let isCandidateCompleted = false;
      
      // Check for completion based on the key and the appropriate data source
      if (Object.keys(signaturesData || {}).includes(form.completionKey)) {
        isCandidateCompleted = !!signaturesData?.[form.completionKey as keyof OnboardingSignatures];
      } else {
        isCandidateCompleted = !!profileData[form.completionKey as keyof CaregiverProfile];
      }
      
      let isAdminCompleted = true; // Default to true

      if (isAnAdmin && isCandidateCompleted && form.adminSchema) {
        const result = form.adminSchema.safeParse(sanitizedProfileData);
        isAdminCompleted = result.success;
        if (!result.success) {
            console.log(`Admin validation failed for ${form.name}:`, result.error.flatten());
        }
      }
      return { ...form, isCandidateCompleted, isAdminCompleted };
    });
    
    const allCandidateFormsComplete = formsWithStatus.every(f => f.isCandidateCompleted);
    const allAdminFieldsComplete = formsWithStatus.every(f => f.isAdminCompleted);

    return { allCandidateFormsComplete, allAdminFieldsComplete, formsToRender: formsWithStatus };
  }, [profileData, signaturesData, isAnAdmin, interview?.onboardingFormsInitiated, allAvailableForms]);

  useEffect(() => {
    setIsVerified(false);
  }, [candidateId]);

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
        } else if (formAction === 'caregiverResponsibilities') {
            result = await generateCaregiverResponsibilitiesPdfAction(candidateId);
        } else if (formAction === 'lightHousekeeping') {
            result = await generateLightHousekeepingPdfAction();
        } else if (formAction === 'caregiverTelephonyInstructions') {
            result = await generateCaregiverTelephonyInstructionsPdfAction(candidateId);
        } else if (formAction === 'emergencyProcedure') {
            result = await generateEmergencyProcedurePdfAction(candidateId);
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

  const handleDownloadAll = () => {
    if (!candidateId) return;
    
    startDownloadingAll(async () => {
        const result = await generateAllFormsAsZipAction(candidateId);
        
        if (result.error) {
            toast({ title: "Download Failed", description: result.error, variant: "destructive" });
        } else if (result.zipData) {
            const fileName = `${profileData?.fullName?.replace(/ /g, '_') || 'candidate'}_hiring_forms.zip`;
            const blob = new Blob([Buffer.from(result.zipData, 'base64')], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Success", description: "All completed forms have been downloaded." });
        }
    });
  }

   const sendNotificationEmail = async (candidate: CaregiverProfile) => {
        setSendingEmailId(candidate.id);
        const result = await sendHiringDocsNotification({
            caregiverId: candidate.id,
            fullName: candidate.fullName,
            email: candidate.email,
            phone: candidate.phone,
        });
        setSendingEmailId(null);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Hiring documents notification sent.' });
            // Optionally, navigate back or refresh data.
            const currentPath = pathname.includes('/admin') ? '/admin/manage-interviews' : '/owner/manage-interviews';
            router.push(currentPath);
        }
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
               {isAnAdmin && formCompletionStates.allCandidateFormsComplete && formCompletionStates.allAdminFieldsComplete && (
                  <div className="mt-4 flex items-center space-x-2">
                    <Checkbox id="verify-forms" checked={isVerified} onCheckedChange={(checked) => setIsVerified(checked as boolean)} />
                    <Label htmlFor="verify-forms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      I have verified all fields and signatures in the below Forms are in conformance to FLRC standards
                    </Label>
                    {isVerified && (
                        <Button onClick={handleDownloadAll} disabled={isDownloadingAll} size="sm">
                            {isDownloadingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Download All Forms
                        </Button>
                    )}
                  </div>
              )}
            </div>
            <div className="flex items-center gap-2">
                {isAnAdmin && (
                  <Button asChild variant="outline">
                    <Link href="/admin/manage-interviews">
                      <ArrowLeft className="mr-2" />
                      Back to Interviews
                    </Link>
                  </Button>
                )}
                <HelpDialog topic="candidateHiringForms" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formCompletionStates.formsToRender.map((form) => {
            const { isCandidateCompleted, isAdminCompleted } = form;
            return (
              <div key={form.name} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <Link href={formLinkHref(form.href)} className="flex items-center gap-4 flex-grow">
                  <FileText className="h-6 w-6 text-accent" />
                  <span className="font-medium">{form.name}</span>
                </Link>
                 <div className="flex items-center gap-2">
                    {isCandidateCompleted && <CheckCircle className="h-6 w-6 text-green-500" title="Completed by Candidate"/>}
                    {isAnAdmin && isCandidateCompleted ? (
                        isAdminCompleted ? (
                             <CheckCircle className="h-6 w-6 text-blue-500" title="Admin Signoff Complete" />
                        ) : (
                             <XCircle className="h-6 w-6 text-destructive" title="Awaiting Admin Completion" />
                        )
                    ) : null}
                    {isAnAdmin && formCompletionStates.allCandidateFormsComplete && formCompletionStates.allAdminFieldsComplete && (
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
