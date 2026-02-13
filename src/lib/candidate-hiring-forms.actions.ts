

'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hcs501Schema, emergencyContactSchema, lic508Schema, soc341aSchema } from './types';

export async function saveHcs501Data(profileId: string, data: any) {
  const validatedFields = hcs501Schema.safeParse(data);

  if (!validatedFields.success) {
    console.error("HCS501 Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    const dataToSave: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(validatedFields.data)) {
        if (value instanceof Date) {
            dataToSave[key] = Timestamp.fromDate(value);
        } else if (value !== undefined) {
            dataToSave[key] = value;
        }
    }
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath('/candidate-hiring-forms/hcs501');
    
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
    
    revalidatePath('/candidate-hiring-forms/emergency-contact');
    
    return { success: true, message: 'Emergency Contact form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving Emergency Contact data:", error);
    return { error: 'Failed to save form data.' };
  }
}

export async function saveLic508Data(profileId: string, data: any) {
  const validatedFields = lic508Schema.passthrough().safeParse(data);

  if (!validatedFields.success) {
    console.error("LIC508 Save Validation Error:", validatedFields.error.flatten());
    return { error: 'Invalid data provided.' };
  }

  try {
    await serverDb.collection('caregiver_profiles').doc(profileId).set(validatedFields.data, { merge: true });
    
    revalidatePath('/candidate-hiring-forms/lic508');
    
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
    const dataToSave: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(validatedFields.data)) {
        if (value instanceof Date) {
            dataToSave[key] = Timestamp.fromDate(value);
        } else if (value !== undefined) {
            dataToSave[key] = value;
        }
    }
    
    await serverDb.collection('caregiver_profiles').doc(profileId).set(dataToSave, { merge: true });
    
    revalidatePath('/candidate-hiring-forms/soc341a');
    
    return { success: true, message: 'SOC 341A form saved successfully.' };
  } catch (error: any) {
    console.error("Error saving SOC 341A data:", error);
    return { error: 'Failed to save form data.' };
  }
}
