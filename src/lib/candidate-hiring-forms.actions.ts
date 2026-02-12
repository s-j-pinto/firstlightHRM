
'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { hcs501Schema } from './types';

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
