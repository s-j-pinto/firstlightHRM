
'use client';

import { Suspense, useTransition, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Loader2, ArrowLeft, Printer, Download, XCircle, Bell, BellOff, Edit2, FileCheck2, FileClock, ClipboardList } from "lucide-react";
import Link from 'next/link';
import { useUser, useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, query, where, collection, limit } from 'firebase/firestore';
import type { CaregiverProfile, Interview, OnboardingSignatures } from '@/lib/types';
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
    generateMasterInterview360PdfAction,
    generateAllFormsAsZipAction
} from '@/lib/candidate-hiring-forms.actions';
import { useToast } from '@/hooks/use-toast';
import { HelpDialog } from '@/components/HelpDialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format, isDate } from 'date-fns';
import { hiringForms, onboardingForms } from '@/lib/hiring-forms';


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
    
    // Sanitize all date-like fields to strings for validation
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
      // Check both textual profile data and the signatures subcollection
      let isCandidateCompleted = false;
      
      // MASTER INTERVIEW 360 is special: it's admin-only and always "completed" if initiated
      if (form.pdfAction === 'masterInterview360') {
          isCandidateCompleted = true;
      } else if (Object.keys(signaturesData || {}).includes(form.completionKey)) {
          isCandidateCompleted = !!signaturesData?.[form.completionKey as keyof OnboardingSignatures];
      } else {
          isCandidateCompleted = !!profileData[form.completionKey as keyof CaregiverProfile];
      }
      
      let isAdminCompleted = false;
      if (isAnAdmin) {
          if (isCandidateCompleted) {
              if (!form.adminSchema) {
                  isAdminCompleted = true;
              } else {
                  const result = form.adminSchema.safeParse(sanitizedProfileData);
                  isAdminCompleted = result.success;
              }
          }
      }
      return { ...form, isCandidateCompleted, isAdminCompleted };
    });
    
    // Filter out MASTER form for non-admins
    const finalForms = isAnAdmin ? formsWithStatus : formsWithStatus.filter(f => f.pdfAction !== 'masterInterview360');

    const allCandidateFormsComplete = formsWithStatus.every(f => f.isCandidateCompleted);
    const allAdminFieldsComplete = formsWithStatus.every(f => f.isAdminCompleted);

    return { allCandidateFormsComplete, allAdminFieldsComplete, formsToRender: finalForms };
  }, [profileData, signaturesData, isAnAdmin, allAvailableForms]);

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
        let fileName = "document.pdf";
        const candidateName = profileData?.fullName || 'Candidate';
        const fileSafeName = candidateName.replace(/ /g, '_');

        if (formAction === 'hcs501') {
            result = await generateHcs501PdfAction(candidateId);
            fileName = `HCS501_${fileSafeName}.pdf`;
        } else if (formAction === 'emergencyContact') {
            result = await generateEmergencyContactPdfAction(candidateId);
            fileName = `Emergency_Contact_${fileSafeName}.pdf`;
        } else if (formAction === 'referenceVerification1') {
            result = await generateReferenceVerification1PdfAction(candidateId);
            fileName = `Reference_Verification_1_${fileSafeName}.pdf`;
        } else if (formAction === 'referenceVerification2') {
            result = await generateReferenceVerification2PdfAction(candidateId);
            fileName = `Reference_Verification_2_${fileSafeName}.pdf`;
        } else if (formAction === 'lic508') {
            result = await generateLic508PdfAction(candidateId);
            fileName = `LIC508_${fileSafeName}.pdf`;
        } else if (formAction === 'soc341a') {
            result = await generateSoc341aPdfAction(candidateId);
            fileName = `SOC341A_${fileSafeName}.pdf`;
        } else if (formAction === 'hcaJobDescription') {
            result = await generateHcaJobDescriptionPdfAction(candidateId);
            fileName = `HCA_Job_Description_${fileSafeName}.pdf`;
        } else if (formAction === 'drugAlcoholPolicy') {
            result = await generateDrugAlcoholPolicyPdfAction(candidateId);
            fileName = `Drug_Alcohol_Policy_${fileSafeName}.pdf`;
        } else if (formAction === 'clientAbandonment') {
            result = await generateClientAbandonmentPdfAction(candidateId);
            fileName = `Client_Abandonment_${fileSafeName}.pdf`;
        } else if (formAction === 'arbitrationAgreement') {
            result = await generateArbitrationAgreementPdfAction(candidateId);
            fileName = `Arbitration_Agreement_${fileSafeName}.pdf`;
        } else if (formAction === 'employeeOrientationAgreement') {
            result = await generateEmployeeOrientationAgreementPdfAction(candidateId);
            fileName = `Orientation_Agreement_${fileSafeName}.pdf`;
        } else if (formAction === 'acknowledgmentForm') {
            result = await generateAcknowledgmentFormPdfAction(candidateId);
            fileName = `Acknowledgment_Form_${fileSafeName}.pdf`;
        } else if (formAction === 'confidentialityAgreement') {
            result = await generateConfidentialityAgreementPdfAction(candidateId);
            fileName = `Confidentiality_Agreement_${fileSafeName}.pdf`;
        } else if (formAction === 'trainingAcknowledgement') {
            result = await generateTrainingAcknowledgementPdfAction(candidateId);
            fileName = `Training_Acknowledgement_${fileSafeName}.pdf`;
        } else if (formAction === 'offerLetter') {
            result = await generateOfferLetterPdfAction(candidateId);
            fileName = `Offer_Letter_${fileSafeName}.pdf`;
        } else if (formAction === 'caregiverResponsibilities') {
            result = await generateCaregiverResponsibilitiesPdfAction(candidateId);
            fileName = `Caregiver_Responsibilities_${fileSafeName}.pdf`;
        } else if (formAction === 'lightHousekeeping') {
            result = await generateLightHousekeepingPdfAction();
            fileName = `Light_Housekeeping_${fileSafeName}.pdf`;
        } else if (formAction === 'caregiverTelephonyInstructions') {
            result = await generateCaregiverTelephonyInstructionsPdfAction(candidateId);
            fileName = `Telephony_Instructions_${fileSafeName}.pdf`;
        } else if (formAction === 'emergencyProcedure') {
            result = await generateEmergencyProcedurePdfAction(candidateId);
            fileName = `Emergency_Procedure_${fileSafeName}.pdf`;
        } else if (formAction === 'masterInterview360') {
            result = await generateMasterInterview360PdfAction(candidateId);
            fileName = `MASTER INTERVIEW 360-${candidateName}.pdf`;
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
            
            // To respect the filename, we use the anchor method
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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
            const isMaster = form.pdfAction === 'masterInterview360';
            return (
              <div key={form.name} className={cn("flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors", isMaster && "bg-accent/5 border-accent/20")}>
                <Link href={formLinkHref(form.href)} className="flex items-center gap-4 flex-grow">
                  {isMaster ? <ClipboardList className="h-6 w-6 text-accent" /> : <FileText className="h-6 w-6 text-accent" />}
                  <span className={cn("font-medium", isMaster && "text-accent font-bold")}>{form.name}</span>
                </Link>
                 <div className="flex items-center gap-2">
                    {!isMaster && isCandidateCompleted && <CheckCircle className="h-6 w-6 text-green-500" title="Completed by Candidate"/>}
                    {isAnAdmin && !isMaster && isCandidateCompleted ? (
                        isAdminCompleted ? (
                             <CheckCircle className="h-6 w-6 text-blue-500" title="Admin Signoff Complete" />
                        ) : (
                             <XCircle className="h-6 w-6 text-destructive" title="Awaiting Admin Completion" />
                        )
                    ) : null}
                    {isAnAdmin && (isCandidateCompleted || isMaster) && (
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
