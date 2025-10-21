
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { careLogSchema } from './types';

// Omit server-generated fields for the payload
const careLogPayloadSchema = careLogSchema.omit({
  createdAt: true,
  lastUpdatedAt: true,
});

type CareLogPayload = z.infer<typeof careLogPayloadSchema>;

export async function saveCareLog(payload: CareLogPayload) {
  const validation = careLogPayloadSchema.safeParse(payload);
  if (!validation.success) {
    return { message: "Invalid data provided.", error: true };
  }

  const { careLogGroupId, caregiverId, caregiverName, logNotes, logImages } = validation.data;
  const firestore = serverDb;

  try {
    const logData = {
      careLogGroupId,
      caregiverId,
      caregiverName,
      logNotes,
      logImages: logImages || [],
      createdAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    };

    await firestore.collection('carelogs').add(logData);

    revalidatePath('/caregiver/carelog-dashboard');
    return { message: "Care log submitted successfully." };

  } catch (error: any) {
    console.error("Error saving CareLog:", error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}
