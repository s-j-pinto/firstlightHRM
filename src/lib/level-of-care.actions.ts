
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { levelOfCareSchema, type LevelOfCareFormData } from './types';


interface SavePayload {
    initialContactId: string;
    assessmentId: string | null;
    formData: LevelOfCareFormData;
}

export async function saveLevelOfCare(payload: SavePayload) {
    const { initialContactId, assessmentId, formData } = payload;

    const validation = levelOfCareSchema.safeParse(formData);
    if (!validation.success) {
        return { message: "Invalid data provided.", error: true };
    }

    const firestore = serverDb;
    const now = Timestamp.now();
    const dataToSave = { ...validation.data, initialContactId, lastUpdatedAt: now };

    try {
        if (assessmentId) {
            const assessmentRef = firestore.collection('level_of_care_assessments').doc(assessmentId);
            await assessmentRef.update(dataToSave);
        } else {
            const assessmentRef = firestore.collection('level_of_care_assessments').doc();
            await assessmentRef.set({ ...dataToSave, createdAt: now });
        }
        
        revalidatePath(`/admin/initial-contact?contactId=${initialContactId}`);
        revalidatePath(`/owner/initial-contact?contactId=${initialContactId}`);
        revalidatePath('/admin/assessments');
        revalidatePath('/owner/dashboard');

        return { message: "Level of Care assessment has been saved successfully." };
    } catch (error: any) {
        console.error("Error saving Level of Care assessment:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}
