

'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hcs501Schema, emergencyContactSchema, lic508Object, soc341aSchema, referenceVerificationSchema, arbitrationAgreementSchema, drugAlcoholPolicySchema, hcaJobDescriptionSchema, clientAbandonmentSchema, employeeOrientationAgreementSchema, acknowledgmentFormSchema, confidentialityAgreementSchema, trainingAcknowledgementSchema } from './types';
import { generateHcs501Pdf, generateEmergencyContactPdf, generateReferenceVerificationPdf, generateLic508Pdf, generateSoc341aPdf, generateHcaJobDescriptionPdf, generateDrugAlcoholPolicyPdf, generateClientAbandonmentPdf, generateArbitrationAgreementPdf, generateEmployeeOrientationAgreementPdf, generateAcknowledgmentFormPdf, generateConfidentialityAgreementPdf, generateTrainingAcknowledgementPdf } from './pdf.actions';

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

export async function saveReferenceVerificationData(profileId: string, data: any) {
  const validatedFields = referenceVerificationSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error("Reference Verification Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave = convertDatesToTimestamps(validatedFields.data);

    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath(`/candidate-hiring-forms/reference-verification?id=${profileId}`);
    revalidatePath('/candidate-hiring-forms');
    
    return { success: true, message: 'Reference Verification form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Reference Verification data:", error);
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

export async function generateReferenceVerificationPdfAction(candidateId: string) {
    if (!candidateId) {
        return { error: 'Candidate ID is required.' };
    }
    try {
        const docSnap = await serverDb.collection('caregiver_profiles').doc(candidateId).get();
        if (!docSnap.exists) {
            return { error: 'Candidate profile not found.' };
        }
        const formData = docSnap.data();
        const result = await generateReferenceVerificationPdf(formData);
        
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
        console.error("Error generating PDF:", error);
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
    




    
