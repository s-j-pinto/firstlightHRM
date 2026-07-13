
'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { parse, isValid } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { 
    hcs501Schema, 
    emergencyContactSchema, 
    lic508Object, 
    soc341aSchema, 
    referenceVerification1Schema, 
    referenceVerification2Schema, 
    arbitrationAgreementSchema, 
    drugAlcoholPolicySchema,
    drugAlcoholPolicyAdminSchema,
    hcaJobDescriptionSchema, 
    clientAbandonmentSchema,
    clientAbandonmentAdminSchema,
    employeeOrientationAgreementSchema,
    employeeOrientationAgreementAdminSchema,
    acknowledgmentFormSchema, 
    confidentialityAgreementSchema,
    confidentialityAgreementAdminSchema,
    trainingAcknowledgementSchema, 
    offerLetterSchema,
    caregiverResponsibilitiesSchema,
    emergencyProcedureSchema,
    masterInterview360Schema
} from './types';
import { 
    generateHcs501Pdf, 
    generateEmergencyContactPdf, 
    generateReferenceVerification1Pdf, 
    generateReferenceVerification2Pdf, 
    generateLic508Pdf, 
    generateSoc341aPdf, 
    generateHcaJobDescriptionPdf, 
    generateDrugAlcoholPolicyPdf, 
    generateClientAbandonmentPdf, 
    generateArbitrationAgreementPdf, 
    generateEmployeeOrientationAgreementPdf, 
    generateAcknowledgmentFormPdf, 
    generateConfidentialityAgreementPdf, 
    generateTrainingAcknowledgementPdf, 
    generateOfferLetterPdf,
    generateCaregiverResponsibilitiesPdf,
    generateLightHousekeepingPdf,
    generateCaregiverTelephonyInstructionsPdf,
    generateEmergencyProcedurePdf,
    generateMasterInterview360Pdf
} from './pdf.actions';
import type { CaregiverProfile } from './types';
import JSZip from 'jszip';

const pacificTimeZone = 'America/Los_Angeles';

// Helper to convert MM/DD/YYYY date strings to Firestore Timestamps
function convertDatesToTimestamps(data: any): any {
    const dataWithTimestamps: { [key: string]: any } = {};
    const skipKeys = ['employmentDates1', 'employmentDates2']; 
    
    for (const [key, value] of Object.entries(data)) {
        if (!skipKeys.includes(key) && typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
            try {
                const [m, d, y] = value.split('/');
                const isoDate = `${y}-${m}-${d}`;
                const date = fromZonedTime(isoDate, pacificTimeZone);
                if (isValid(date)) {
                    dataWithTimestamps[key] = Timestamp.fromDate(date);
                    continue;
                }
            } catch (e) {}
        }
        dataWithTimestamps[key] = value;
    }
    return dataWithTimestamps;
}

// Optimization: Separate signature fields (heavy base64) from textual data
function extractSignatures(data: any): { textual: any, signatures: any } {
    const signatureFields = [
        'hcs501EmployeeSignature',
        'applicantSignature1',
        'applicantSignature2',
        'lic508Signature',
        'soc341aSignature',
        'arbitrationAgreementSignature',
        'drugAlcoholPolicySignature',
        'drugAlcoholPolicyRepSignature',
        'jobDescriptionSignature',
        'clientAbandonmentSignature',
        'clientAbandonmentWitnessSignature',
        'orientationAgreementSignature',
        'orientationAgreementWitnessSignature',
        'acknowledgmentSignature',
        'confidentialityAgreementEmployeeSignature',
        'confidentialityAgreementRepSignature',
        'trainingAcknowledgementSignature',
        'offerLetterSignature',
        'caregiverResponsibilitiesSignature',
        'emergencyProcedureSignature'
    ];

    const textual: any = {};
    const signatures: any = {};

    for (const key in data) {
        if (signatureFields.includes(key)) {
            signatures[key] = data[key];
        } else {
            textual[key] = data[key];
        }
    }
    return { textual, signatures };
}

async function saveThinData(profileId: string, data: any) {
    const { textual, signatures } = extractSignatures(data);
    const dataToSave = convertDatesToTimestamps(textual);
    
    const batch = serverDb.batch();
    const profileRef = serverDb.collection('caregiver_profiles').doc(profileId);
    const signaturesRef = profileRef.collection('signatures').doc('onboarding_main');

    if (Object.keys(dataToSave).length > 0) {
        batch.set(profileRef, dataToSave, { merge: true });
    }
    if (Object.keys(signatures).length > 0) {
        batch.set(signaturesRef, signatures, { merge: true });
    }

    await batch.commit();
}


export async function saveHcs501Data(profileId: string, data: any) {
  const validatedFields = hcs501Schema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'HCS 501 form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveEmergencyContactData(profileId: string, data: any) {
  const validatedFields = emergencyContactSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Emergency Contacts have been saved.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveLic508Data(profileId: string, data: any) {
  const validatedFields = lic508Object.passthrough().safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'LIC 508 form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveSoc341aData(profileId: string, data: any) {
  const validatedFields = soc341aSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'SOC 341A form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveReferenceVerification1Data(profileId: string, data: any) {
  const validatedFields = referenceVerification1Schema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Reference Verification 1 form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveReferenceVerification2Data(profileId: string, data: any) {
  const validatedFields = referenceVerification2Schema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Reference Verification 2 form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveArbitrationAgreementData(profileId: string, data: any) {
  const validatedFields = arbitrationAgreementSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Mutual Arbitration Agreement saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveDrugAlcoholPolicyData(profileId: string, data: any) {
  const validatedFields = drugAlcoholPolicySchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Drug and/or Alcohol Testing Consent Form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveHcaJobDescriptionData(profileId: string, data: any) {
  const validatedFields = hcaJobDescriptionSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'HCA Job Description form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveClientAbandonmentData(profileId: string, data: any) {
  const validatedFields = clientAbandonmentSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Client Abandonment form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveEmployeeOrientationAgreementData(profileId: string, data: any) {
  const validatedFields = employeeOrientationAgreementSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Employee Orientation Agreement saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveAcknowledgmentFormData(profileId: string, data: any) {
  const validatedFields = acknowledgmentFormSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Acknowledgment form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveConfidentialityAgreementData(profileId: string, data: any) {
  const validatedFields = confidentialityAgreementSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Confidentiality Agreement saved successfully.' };
  } catch (error: any) { return { error: `An unexpected server error occurred: ${error.message}` }; }
}

export async function saveTrainingAcknowledgementData(profileId: string, data: any) {
  const validatedFields = trainingAcknowledgementSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Training Acknowledgement form saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveOfferLetterData(profileId: string, data: any) {
  const validatedFields = offerLetterSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Offer Letter saved successfully.' };
  } catch (error: any) { return { error: 'Failed to save form data.' }; }
}

export async function saveCaregiverResponsibilitiesData(profileId: string, data: any) {
    const validatedFields = caregiverResponsibilitiesSchema.safeParse(data);
    if (!validatedFields.success) return { error: 'Invalid data provided.' };
    try {
        await saveThinData(profileId, validatedFields.data);
        revalidatePath('/candidate-hiring-forms');
        return { success: true, message: 'Caregiver Responsibilities saved successfully.' };
    } catch (e: any) { return { error: `Failed to save: ${e.message}` }; }
}

export async function saveLightHousekeepingAcknowledgement(profileId: string) {
    if (!profileId) return { error: 'Profile ID is required.' };
    try {
        await serverDb.collection('caregiver_profiles').doc(profileId).set({ lightHousekeepingAcknowledged: true }, { merge: true });
        revalidatePath('/candidate-hiring-forms');
        return { success: true, message: 'Acknowledgement saved.' };
    } catch (e: any) { return { error: `Failed to save: ${e.message}` }; }
}

export async function saveTelephonyInstructionsData(profileId: string) {
    if (!profileId) return { error: 'Profile ID is required.' };
    try {
        await serverDb.collection('caregiver_profiles').doc(profileId).set({ telephonyInstructionsAcknowledged: true }, { merge: true });
        revalidatePath('/candidate-hiring-forms');
        return { success: true, message: 'Telephony instructions acknowledged.' };
    } catch (e: any) { return { error: `Failed to save: ${e.message}` }; }
}

export async function saveEmergencyProcedureData(profileId: string, data: any) {
  const validatedFields = emergencyProcedureSchema.safeParse(data);
  if (!validatedFields.success) return { error: 'Invalid data provided.' };
  try {
    await saveThinData(profileId, validatedFields.data);
    revalidatePath('/candidate-hiring-forms');
    return { success: true, message: 'Emergency Procedures form saved successfully.' };
  } catch (error: any) { return { error: `Failed to save form data: ${error.message}` }; }
}

async function getFullCandidateData(candidateId: string) {
    const profileDoc = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
    if (!profileDoc.exists) return null;
    const signaturesDoc = await profileDoc.ref.collection('signatures').doc('onboarding_main').get();
    
    // Find interview
    const interviewQuery = await serverDb.collection('interviews').where('caregiverProfileId', '==', candidateId).limit(1).get();
    const interviewData = !interviewQuery.empty ? interviewQuery.docs[0].data() : {};

    return {
        ...profileDoc.data(),
        ...interviewData,
        ...(signaturesDoc.exists ? signaturesDoc.data() : {})
    };
}

export async function saveMasterInterview360Data(profileId: string, data: any) {
    const validated = masterInterview360Schema.safeParse(data);
    if (!validated.success) return { error: 'Invalid data provided.' };
    
    try {
        const firestore = serverDb;
        const profileRef = firestore.collection('caregiver_profiles').doc(profileId);
        
        // Split data between profile and interview
        const profileFields = ['source', 'overnightStayAvailability', 'availability'];
        const profileUpdate: any = {};
        const interviewUpdate: any = {};
        
        Object.entries(validated.data).forEach(([key, value]) => {
            if (profileFields.includes(key)) profileUpdate[key] = value;
            else interviewUpdate[key] = value;
        });

        // Add the completion flag
        interviewUpdate.master360Saved = true;

        const batch = firestore.batch();
        if (Object.keys(profileUpdate).length > 0) batch.update(profileRef, profileUpdate);
        
        const interviewQuery = await firestore.collection('interviews').where('caregiverProfileId', '==', profileId).limit(1).get();
        if (!interviewQuery.empty) {
            batch.update(interviewQuery.docs[0].ref, { ...interviewUpdate, lastUpdatedAt: Timestamp.now() });
        } else {
            const intRef = firestore.collection('interviews').doc();
            batch.set(intRef, { ...interviewUpdate, caregiverProfileId: profileId, createdAt: Timestamp.now(), lastUpdatedAt: Timestamp.now(), phoneScreenPassed: 'Yes', interviewType: 'Phone' });
        }

        await batch.commit();
        revalidatePath('/candidate-hiring-forms');
        revalidatePath('/admin/advanced-search');
        revalidatePath('/admin/manage-interviews');
        return { success: true };
    } catch (e: any) { return { error: e.message }; }
}

export async function generateHcs501PdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        const employeeDoc = await serverDb.collection('caregiver_employees').doc(candidateId).get();
        const combinedData = { ...fullData, ...(employeeDoc.exists ? employeeDoc.data() : {}) };
        return await generateHcs501Pdf(combinedData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateEmergencyContactPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateEmergencyContactPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateReferenceVerification1PdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateReferenceVerification1Pdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateReferenceVerification2PdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateReferenceVerification2Pdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateLic508PdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateLic508Pdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateSoc341aPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateSoc341aPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateHcaJobDescriptionPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateHcaJobDescriptionPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateDrugAlcoholPolicyPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateDrugAlcoholPolicyPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}
  
export async function generateClientAbandonmentPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateClientAbandonmentPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateArbitrationAgreementPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateArbitrationAgreementPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateEmployeeOrientationAgreementPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateEmployeeOrientationAgreementPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateAcknowledgmentFormPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateAcknowledgmentFormPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateConfidentialityAgreementPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateConfidentialityAgreementPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateTrainingAcknowledgementPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateTrainingAcknowledgementPdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateOfferLetterPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        const settingsSnap = await serverDb.collection('settings').doc('hiring_form_fields').get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
        const combinedData = { ...fullData, ...settingsData };
        return await generateOfferLetterPdf(combinedData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateCaregiverResponsibilitiesPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateCaregiverResponsibilitiesPdf(fullData);
    } catch (e: any) { return { error: `Failed to generate PDF: ${e.message}` }; }
}

export async function generateLightHousekeepingPdfAction() {
    try { return await generateLightHousekeepingPdf(); } catch (e: any) { return { error: `Failed to generate PDF: ${e.message}` }; }
}

export async function generateCaregiverTelephonyInstructionsPdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        const employeeSnap = await serverDb.collection('caregiver_employees').doc(candidateId).get();
        const combinedData = { ...fullData, ...employeeSnap.data() };
        return await generateCaregiverTelephonyInstructionsPdf(combinedData);
    } catch (e: any) { return { error: `Failed to generate PDF: ${e.message}` }; }
}

export async function generateEmergencyProcedurePdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateEmergencyProcedurePdf(fullData);
    } catch (error: any) { return { error: `Failed to generate PDF: ${error.message}` }; }
}

export async function generateMasterInterview360PdfAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        return await generateMasterInterview360Pdf(fullData);
    } catch (e: any) { return { error: `Failed to generate PDF: ${e.message}` }; }
}

export async function generateAllFormsAsZipAction(candidateId: string) {
    if (!candidateId) return { error: 'Candidate ID is required.' };
    try {
        const fullData = await getFullCandidateData(candidateId);
        if (!fullData) return { error: 'Candidate profile not found.' };
        const zip = new JSZip();
        const candidateName = fullData.fullName || 'Candidate';
        
        const formGenerators = [
            { key: 'id', name: `MASTER INTERVIEW 360-${candidateName}.pdf`, generator: generateMasterInterview360Pdf },
            { key: 'hcs501EmployeeSignature', name: 'HCS501 - Personnel Record.pdf', generator: generateHcs501Pdf },
            { key: 'emergencyContact1_name', name: 'Emergency Contact.pdf', generator: generateEmergencyContactPdf },
            { key: 'applicantSignature1', name: 'Reference Verification 1.pdf', generator: generateReferenceVerification1Pdf },
            { key: 'applicantSignature2', name: 'Reference Verification 2.pdf', generator: generateReferenceVerification2Pdf },
            { key: 'lic508Signature', name: 'LIC508 - Criminal Record Statement.pdf', generator: generateLic508Pdf },
            { key: 'soc341aSignature', name: 'SOC341A - Elder Abuse Reporting.pdf', generator: generateSoc341aPdf },
            { key: 'arbitrationAgreementSignature', name: 'Mutual Arbitration Agreement.pdf', generator: generateArbitrationAgreementPdf },
            { key: 'drugAlcoholPolicySignature', name: 'Drug and Alcohol Policy.pdf', generator: generateDrugAlcoholPolicyPdf },
            { key: 'jobDescriptionSignature', name: 'HCA Job Description.pdf', generator: generateHcaJobDescriptionPdf },
            { key: 'clientAbandonmentSignature', name: 'Client Abandonment Policy.pdf', generator: generateClientAbandonmentPdf },
            { key: 'orientationAgreementSignature', name: 'Employee Orientation Agreement.pdf', generator: generateEmployeeOrientationAgreementPdf },
            { key: 'acknowledgmentSignature', name: 'Acknowledgement Form.pdf', generator: generateAcknowledgmentFormPdf },
            { key: 'confidentialityAgreementEmployeeSignature', name: 'Confidentiality Agreement.pdf', generator: generateConfidentialityAgreementPdf },
            { key: 'trainingAcknowledgementSignature', name: 'Training Acknowledgement.pdf', generator: generateTrainingAcknowledgementPdf },
            { key: 'offerLetterSignature', name: 'Offer Letter.pdf', generator: generateOfferLetterPdf },
            { key: 'caregiverResponsibilitiesSignature', name: 'Caregiver Responsibilities.pdf', generator: generateCaregiverResponsibilitiesPdf },
            { key: 'lightHousekeepingAcknowledged', name: 'Light Housekeeping.pdf', generator: generateLightHousekeepingPdf },
            { key: 'telephonyInstructionsAcknowledged', name: 'Caregiver Telephony Instructions.pdf', generator: generateCaregiverTelephonyInstructionsPdf },
            { key: 'emergencyProcedureSignature', name: 'Caregiver Emergency Procedures.pdf', generator: generateEmergencyProcedurePdf },
        ];
        const settingsSnap = await serverDb.collection('settings').doc('hiring_form_fields').get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
        let generatedFileCount = 0;
        for (const form of formGenerators) {
            let isComplete = !!(fullData as any)[form.key];
            if (isComplete) {
                try {
                    let dataForGenerator = { ...fullData, ...settingsData };
                    if (form.key === 'telephonyInstructionsAcknowledged' || form.key === 'hcs501EmployeeSignature') {
                        const employeeSnap = await serverDb.collection('caregiver_employees').doc(candidateId).get();
                        dataForGenerator = { ...dataForGenerator, ...employeeSnap.data() };
                    }
                    const pdfResult = await form.generator(dataForGenerator);
                    if (pdfResult.pdfData) {
                        zip.file(form.name, pdfResult.pdfData, { base64: true });
                        generatedFileCount++;
                    }
                } catch (pdfError) {}
            }
        }
        if (generatedFileCount === 0) return { error: 'No completed forms found to download.' };
        const zipAsBase64 = await zip.generateAsync({ type: 'base64' });
        return { zipData: zipAsBase64 };
    } catch (error: any) { return { error: `Failed to generate zip file: ${error.message}` }; }
}
