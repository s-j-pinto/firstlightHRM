

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { careLogSchema } from './types';
import { parse, isValid } from 'date-fns';

export async function saveAllstarAdminData(payload: { logIds: string[]; adminData: any; }) {
    const { logIds, adminData } = payload;
    const firestore = serverDb;

    if (!logIds || logIds.length === 0) {
        return { error: 'No logs found for the selected week to update.' };
    }

    try {
        const batch = firestore.batch();
        const updatePayload: { [key: string]: any } = {
            'templateData.allstar_route_sheet.checkedBy': adminData.checkedBy || null,
            'templateData.allstar_route_sheet.remarks': adminData.remarks || null,
            lastUpdatedAt: Timestamp.now(),
        };
        
        if (adminData.dateSubmitted && /^\d{2}\/\d{2}\/\d{4}$/.test(adminData.dateSubmitted)) {
            updatePayload['templateData.allstar_route_sheet.dateSubmitted'] = Timestamp.fromDate(parse(adminData.dateSubmitted, 'MM/dd/yyyy', new Date()));
        }
        if (adminData.checkedDate && /^\d{2}\/\d{2}\/\d{4}$/.test(adminData.checkedDate)) {
            updatePayload['templateData.allstar_route_sheet.checkedDate'] = Timestamp.fromDate(parse(adminData.checkedDate, 'MM/dd/yyyy', new Date()));
        }

        logIds.forEach(logId => {
            const logRef = firestore.collection('carelogs').doc(logId);
            batch.update(logRef, updatePayload);
        });
        
        await batch.commit();

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
  console.error("DEPRECATED: saveCareLog server action was called but is no longer in use.");
  return { message: "This function is deprecated.", error: true };
}
