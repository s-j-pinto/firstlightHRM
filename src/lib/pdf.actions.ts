

'use server';

// This file now acts as a barrel, re-exporting the individual PDF generators.
// This keeps the import paths consistent for the rest of the application
// while allowing for easier maintenance of the PDF generation logic.

import { generateAllstarWeeklyReportPdf as generateAllstarWeeklyReportPdfInternal } from './pdf-generators/allstar-weekly-report';
import { generateHcs501Pdf as generateHcs501PdfInternal } from './pdf-generators/hcs501';
import { generateEmergencyContactPdf as generateEmergencyContactPdfInternal } from './pdf-generators/emergency-contact';
import { generateReferenceVerification1Pdf as generateReferenceVerification1PdfInternal } from './pdf-generators/reference-verification-1';
import { generateReferenceVerification2Pdf as generateReferenceVerification2PdfInternal } from './pdf-generators/reference-verification-2';
import { generateLic508Pdf as generateLic508PdfInternal } from './pdf-generators/lic508';
import { generateSoc341aPdf as generateSoc341aPdfInternal } from './pdf-generators/soc341a';
import { generateHcaJobDescriptionPdf as generateHcaJobDescriptionPdfInternal } from './pdf-generators/hca-job-description';
import { generateDrugAlcoholPolicyPdf as generateDrugAlcoholPolicyPdfInternal } from './pdf-generators/drug-alcohol-policy';
import { generateClientAbandonmentPdf as generateClientAbandonmentPdfInternal } from './pdf-generators/client-abandonment';
import { generateArbitrationAgreementPdf as generateArbitrationAgreementPdfInternal } from './pdf-generators/arbitration-agreement';
import { generateEmployeeOrientationAgreementPdf as generateEmployeeOrientationAgreementPdfInternal } from './pdf-generators/employee-orientation-agreement';
import { generateAcknowledgmentFormPdf as generateAcknowledgmentFormPdfInternal } from './pdf-generators/acknowledgment-form';
import { generateConfidentialityAgreementPdf as generateConfidentialityAgreementPdfInternal } from './pdf-generators/confidentiality-agreement';
import { generateTrainingAcknowledgementPdf as generateTrainingAcknowledgementPdfInternal } from './pdf-generators/training-acknowledgement';
import { generateOfferLetterPdf as generateOfferLetterPdfInternal } from './pdf-generators/offer-letter';
import { generateClientIntakePdf as generateClientIntakePdfInternal } from './pdf-generators/client-intake';
import { generateTppCsaPdf as generateTppCsaPdfInternal } from './pdf-generators/tpp-csa';
import { generateCaregiverResponsibilitiesPdf as generateCaregiverResponsibilitiesPdfInternal } from './pdf-generators/caregiver-responsibilities';
import { generateLightHousekeepingPdf as generateLightHousekeepingPdfInternal } from './pdf-generators/light-housekeeping';
import { generateCaregiverTelephonyInstructionsPdf as generateCaregiverTelephonyInstructionsPdfInternal } from './pdf-generators/caregiver-telephony-instructions';
import { generateEmergencyProcedurePdf as generateEmergencyProcedurePdfInternal } from './pdf-generators/emergency-procedure';
import { generateVaWeeklyReportPdf as generateVaWeeklyReportPdfInternal } from './pdf-generators/va-weekly-report';
import { serverDb } from '@/firebase/server-init';

export async function generateHcs501Pdf(formData: any) { return generateHcs501PdfInternal(formData); }
export async function generateEmergencyContactPdf(formData: any) { return generateEmergencyContactPdfInternal(formData); }
export async function generateReferenceVerification1Pdf(formData: any) { return generateReferenceVerification1PdfInternal(formData); }
export async function generateReferenceVerification2Pdf(formData: any) { return generateReferenceVerification2PdfInternal(formData); }
export async function generateLic508Pdf(formData: any) { return generateLic508PdfInternal(formData); }
export async function generateSoc341aPdf(formData: any) { return generateSoc341aPdfInternal(formData); }
export async function generateHcaJobDescriptionPdf(formData: any) { return generateHcaJobDescriptionPdfInternal(formData); }
export async function generateDrugAlcoholPolicyPdf(formData: any) { return generateDrugAlcoholPolicyPdfInternal(formData); }
export async function generateClientAbandonmentPdf(formData: any) { return generateClientAbandonmentPdfInternal(formData); }
export async function generateArbitrationAgreementPdf(formData: any) { return generateArbitrationAgreementPdfInternal(formData); }
export async function generateEmployeeOrientationAgreementPdf(formData: any) { return generateEmployeeOrientationAgreementPdfInternal(formData); }
export async function generateAcknowledgmentFormPdf(formData: any) { return generateAcknowledgmentFormPdfInternal(formData); }
export async function generateConfidentialityAgreementPdf(formData: any) { return generateConfidentialityAgreementPdfInternal(formData); }
export async function generateTrainingAcknowledgementPdf(formData: any) { return generateTrainingAcknowledgementPdfInternal(formData); }
export async function generateOfferLetterPdf(formData: any) { return generateOfferLetterPdfInternal(formData); }
export async function generateClientIntakePdf(formData: any, formType?: 'private' | 'tpp') {
  if (formType === 'tpp') {
    const pdfBytes = await generateTppCsaPdfInternal(formData);
    return { pdfData: Buffer.from(pdfBytes).toString('base64') };
  }
  const pdfBytes = await generateClientIntakePdfInternal(formData);
  return { pdfData: Buffer.from(pdfBytes).toString('base64') };
}
export async function generateTppCsaPdf(formData: any) { 
    const pdfBytes = await generateTppCsaPdfInternal(formData);
    return { pdfData: Buffer.from(pdfBytes).toString('base64') };
}
export async function generateCaregiverResponsibilitiesPdf(formData: any) { return generateCaregiverResponsibilitiesPdfInternal(formData); }
export async function generateLightHousekeepingPdf() { return generateLightHousekeepingPdfInternal(); }
export async function generateCaregiverTelephonyInstructionsPdf(formData: any) { return generateCaregiverTelephonyInstructionsPdfInternal(formData); }
export async function generateEmergencyProcedurePdf(formData: any) { return generateEmergencyProcedurePdfInternal(formData); }


export async function generateAllstarWeeklyReportPdf(data: any) {
    try {
        const result = await generateAllstarWeeklyReportPdfInternal(data);
        return result;
    } catch (error: any) {
        console.error("Error during PDF generation process:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateVaWeeklyReportPdf(data: any) {
    if (!data.groupId || !data.weekOf || !data.caregiverName) {
        return { error: "Missing required data for PDF generation." };
    }
    
    try {
        const groupDoc = await serverDb.collection('carelog_groups').doc(data.groupId).get();
        if(!groupDoc.exists) return { error: "Carelog group not found." };
        const groupData = groupDoc.data();
        
        const clientDoc = groupData?.clientId ? await serverDb.collection('Clients').doc(groupData.clientId).get() : null;
        
        const templateDoc = groupData?.careLogTemplateId ? await serverDb.collection('va_task_templates').doc(groupData.careLogTemplateId).get() : null;
        if(!templateDoc?.exists) return { error: "VA Task template not found." };

        const payload = {
            ...data,
            groupData: groupData,
            clientData: clientDoc?.exists ? clientDoc.data() : {},
            templateData: templateDoc.data(),
        };

        const result = await generateVaWeeklyReportPdfInternal(payload);
        return result;
    } catch (error: any) {
        console.error("Error during VA Report PDF generation process:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
