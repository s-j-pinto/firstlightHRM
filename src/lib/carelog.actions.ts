
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { careLogSchema } from './types';
import { parse } from 'date-fns';

export async function saveAllstarAdminData(payload: { logId: string; adminData: any; }) {
    const { logId, adminData } = payload;
    const firestore = serverDb;

    try {
        const logRef = firestore.collection('carelogs').doc(logId);
        
        const updatePayload: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(adminData)) {
            if ((key === 'dateSubmitted' || key === 'checkedDate') && value && typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                updatePayload[`templateData.allstar_route_sheet.${key}`] = Timestamp.fromDate(parse(value, 'MM/dd/yyyy', new Date()));
            } else {
                updatePayload[`templateData.allstar_route_sheet.${key}`] = value;
            }
        }
        updatePayload['lastUpdatedAt'] = Timestamp.now();

        await logRef.update(updatePayload);

        revalidatePath(`/staffing-admin/reports/carelog`, 'layout');
        return { success: true };

    } catch (error: any) {
        console.error("Error saving Allstar admin data:", error);
        return { error: `An error occurred: ${error.message}` };
    }
}


// This file is now primarily for revalidation, as the write operation
// has been moved to the client to enable better error handling.

export async function revalidateCareLog() {
  revalidatePath('/caregiver/carelog-dashboard');
}

/**
 * @deprecated This function is deprecated. The logic has been moved to the client-side
 * in `carelog-client.tsx` to implement improved, contextual error handling for
 * Firestore security rules. This server action may be removed in a future version.
 */
export async function saveCareLog(payload: any) {
  console.error("DEPRECATED: saveCareLog server action was called. This logic has moved to the client.");
  return { message: "This function is deprecated.", error: true };
}
