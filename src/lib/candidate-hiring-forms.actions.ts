
'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hcs501Schema, emergencyContactSchema, lic508Object, soc341aSchema, referenceVerificationSchema } from './types';
import { generateHcs501Pdf, generateEmergencyContactPdf, generateReferenceVerificationPdf, generateLic508Pdf, generateSoc341aPdf } from './pdf.actions';

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
    


    