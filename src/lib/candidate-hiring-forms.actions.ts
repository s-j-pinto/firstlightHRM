

'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hcs501Schema, emergencyContactSchema, lic508Object, soc341aSchema, referenceVerification1Schema, referenceVerification2Schema, arbitrationAgreementSchema, drugAlcoholPolicySchema, hcaJobDescriptionSchema, clientAbandonmentSchema, employeeOrientationAgreementSchema, acknowledgmentFormSchema, confidentialityAgreementSchema, trainingAcknowledgementSchema, offerLetterSchema } from './types';
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
    generateOfferLetterPdf
} from './pdf.actions';
import type { CaregiverProfile } from './types';
import JSZip from 'jszip';


// Helper to convert date strings to Firestore Timestamps if they are valid dates
function convertDatesToTimestamps(data: any): any {
    const dataWithTimestamps: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && key.toLowerCase().includes('date')) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                dataWithTimestamps[key] = Timestamp.fromDate(date);
                continue;
            }
        }
        if (value instanceof Date) {
             dataWithTimestamps[key] = Timestamp.fromDate(value);
             continue;
        }
        dataWithTimestamps[key] = value;
    }
    return dataWithTimestamps;
}


export async function saveHcs501Data(profileId: string, data: any) {
  const validatedFields = hcs501Schema.safeParse(data);

  if (!validatedFields.success) {
    console.error("HCS501 Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/hcs501?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'HCS 501 form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving HCS 501 data:", error);
    return { error: 'Failed to save form data.' };
  }
}


export async function saveEmergencyContactData(profileId: string, data: any) {
  const validatedFields = emergencyContactSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Emergency Contact Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    await serverDb.collection('caregiver_profiles').doc(profileId).set(validatedFields.data, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/emergency-contact?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Emergency Contact form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Emergency Contact data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveLic508Data(profileId: string, data: any) {
  const validatedFields = lic508Object.passthrough().safeParse(data);

  if (!validatedFields.success) {
    console.error("LIC508 Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/lic508?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'LIC 508 form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving LIC 508 data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveSoc341aData(profileId: string, data: any) {
  const validatedFields = soc341aSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("SOC341A Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/soc341a?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'SOC 341A form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving SOC 341A data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveReferenceVerification1Data(profileId: string, data: any) {
  const validatedFields = referenceVerification1Schema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Reference Verification 1 Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);

    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/reference-verification-1?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Reference Verification 1 form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Reference Verification 1 data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveReferenceVerification2Data(profileId: string, data: any) {
  const validatedFields = referenceVerification2Schema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Reference Verification 2 Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);

    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/reference-verification-2?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Reference Verification 2 form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Reference Verification 2 data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveArbitrationAgreementData(profileId: string, data: any) {
  const validatedFields = arbitrationAgreementSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Arbitration Agreement Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/arbitration-agreement?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Mutual Arbitration Agreement saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Mutual Arbitration Agreement data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveDrugAlcoholPolicyData(profileId: string, data: any) {
  const validatedFields = drugAlcoholPolicySchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Drug Alcohol Policy Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/drug-alcohol-policy?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Drug and/or Alcohol Testing Consent Form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Drug and/or Alcohol Testing Consent Form data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveHcaJobDescriptionData(profileId: string, data: any) {
  const validatedFields = hcaJobDescriptionSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("HCA Job Description Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/hca-job-description?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'HCA Job Description form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving HCA Job Description data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveClientAbandonmentData(profileId: string, data: any) {
  const validatedFields = clientAbandonmentSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Client Abandonment Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/client-abandonment?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Client Abandonment form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Client Abandonment data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveEmployeeOrientationAgreementData(profileId: string, data: any) {
  const validatedFields = employeeOrientationAgreementSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Employee Orientation Agreement Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/employee-orientation-agreement?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Employee Orientation Agreement saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Employee Orientation Agreement data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveAcknowledgmentFormData(profileId: string, data: any) {
  const validatedFields = acknowledgmentFormSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Acknowledgment Form Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/acknowledgment-form?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Acknowledgment form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Acknowledgment form data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveConfidentialityAgreementData(profileId: string, data: any) {
  const validatedFields = confidentialityAgreementSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Confidentiality Agreement Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/confidentiality-agreement?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Confidentiality Agreement saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Confidentiality Agreement data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveTrainingAcknowledgementData(profileId: string, data: any) {
  const validatedFields = trainingAcknowledgementSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Training Acknowledgement Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/training-acknowledgement?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Training Acknowledgement form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Training Acknowledgement form data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveOfferLetterData(profileId: string, data: any) {
  const validatedFields = offerLetterSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Offer Letter Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/offer-letter?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Offer Letter saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Offer Letter data:", error);
    return { error: 'Failed to save form data.' };
  }
}


export async function generateHcs501PdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateHcs501Pdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateEmergencyContactPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateEmergencyContactPdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateReferenceVerification1PdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateReferenceVerification1Pdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateReferenceVerification2PdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateReferenceVerification2Pdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}


export async function generateLic508PdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateLic508Pdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateSoc341aPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateSoc341aPdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateHcaJobDescriptionPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateHcaJobDescriptionPdf(formData);
        
        return result;
    } catch (error: any) {
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateDrugAlcoholPolicyPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateDrugAlcoholPolicyPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
  
export async function generateClientAbandonmentPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateClientAbandonmentPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateArbitrationAgreementPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateArbitrationAgreementPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateEmployeeOrientationAgreementPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateEmployeeOrientationAgreementPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating Employee Orientation Agreement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateAcknowledgmentFormPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateAcknowledgmentFormPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating Acknowledgment Form PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateConfidentialityAgreementPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateConfidentialityAgreementPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating Confidentiality Agreement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateTrainingAcknowledgementPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateTrainingAcknowledgementPdf(formData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating Training Acknowledgement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateOfferLetterPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        
        // Fetch settings data
        const settingsSnap = await serverDb.collection('settings').doc('hiring_form_fields').get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() : {};

        const combinedData = { ...formData, ...settingsData };
        
        const result = await generateOfferLetterPdf(combinedData);
        
        return result;
    } catch (error: any) {
        console.error("Error generating Offer Letter PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateAllFormsAsZipAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }

    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data() as CaregiverProfile;
        const zip = new JSZip();

        const formGenerators = [
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
        ];
        
        const settingsSnap = await serverDb.collection('settings').doc('hiring_form_fields').get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
        const combinedData = { ...formData, ...settingsData };
        let generatedFileCount = 0;

        for (const form of formGenerators) {
            if (formData[form.key as keyof CaregiverProfile]) {
                try {
                    const pdfResult = await form.generator(form.key === 'offerLetterSignature' ? combinedData : formData);
                    if (pdfResult.pdfData) {
                        zip.file(form.name, pdfResult.pdfData, { base64: true });
                        generatedFileCount++;
                    } else {
                        console.warn(`Could not generate PDF for ${form.name}: ${pdfResult.error}`);
                        zip.file(`${form.name}.error.txt`, `Failed to generate PDF: ${pdfResult.error}`);
                    }
                } catch (pdfError: any) {
                     console.error(`Critical error generating PDF for ${form.name}:`, pdfError);
                     zip.file(`${form.name}.error.txt`, `Failed to generate PDF due to a critical error: ${pdfError.message}`);
                }
            }
        }
        
        if (generatedFileCount === 0) {
            return { error: 'No completed forms found to download.' };
        }

        const zipAsBase64 = await zip.generateAsync({ type: 'base64' });
        return { zipData: zipAsBase64 };

    } catch (error: any) {
        console.error("Error generating all forms zip:", error);
        return { error: `Failed to generate zip file: ${error.message}` };
    }
}
