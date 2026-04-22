
'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { careLogSchema } from './types';
import { parse, isValid } from 'date-fns';

export async function saveAllstarVisitAndAdminData(payload: {
    logId: string;
    visitData: any;
    adminData: any;
}) {
    const { logId, visitData, adminData } = payload;
    const firestore = serverDb;

    try {
        const logRef = firestore.collection('carelogs').doc(logId);

        const dataToSave: { [key: string]: any } = {};

        // Map visitData to Firestore fields using dot notation
        for (const key in visitData) {
            const firestoreKey = `templateData.allstar_route_sheet.${key}`;
            if (key === 'serviceDate' && visitData[key]) {
                const date = parse(visitData[key], 'MM/dd/yyyy', new Date());
                 if (isValid(date)) {
                    dataToSave[firestoreKey] = Timestamp.fromDate(date);
                } else {
                    dataToSave[firestoreKey] = null; // Or handle invalid date string
                }
            } else {
                dataToSave[firestoreKey] = visitData[key] || null; // Use null for empty values
            }
        }

        // Map adminData to Firestore fields
        for (const key in adminData) {
            const firestoreKey = `templateData.allstar_route_sheet.${key}`;
            if ((key === 'dateSubmitted' || key === 'checkedDate') && adminData[key]) {
                 const date = parse(adminData[key], 'MM/dd/yyyy', new Date());
                 if (isValid(date)) {
                    dataToSave[firestoreKey] = Timestamp.fromDate(date);
                } else {
                    dataToSave[firestoreKey] = null;
                }
            } else {
                 dataToSave[firestoreKey] = adminData[key] || null;
            }
        }

        dataToSave.lastUpdatedAt = Timestamp.now();

        await logRef.update(dataToSave);

        // Revalidate the path of the parent report page
        const logDoc = await logRef.get();
        const groupId = logDoc.data()?.careLogGroupId;
        if (groupId) {
             revalidatePath(`/staffing-admin/reports/carelog/${groupId}`);
        }
       
        return { success: true };

    } catch (error: any) {
        console.error("Error saving Allstar visit data:", error);
        return { error: `An error occurred: ${error.message}` };
    }
}


export async function saveVaShiftAdminData(payload: {
    shiftId: string;
    tasks: Record<string, boolean>;
    providerSignature: string;
    groupId: string;
}) {
    const { shiftId, tasks, providerSignature, groupId } = payload;
    const firestore = serverDb;

    try {
        const shiftRef = firestore.collection('va_teletrack_shifts').doc(shiftId);
        
        await shiftRef.update({
            tasks: tasks || {},
            providerSignature: providerSignature || '',
            lastUpdatedAt: Timestamp.now(),
        });
        
        revalidatePath(`/staffing-admin/reports/va-report/${groupId}`);
        return { success: true };
    } catch (error: any) {
        console.error("Error saving VA shift admin data:", error);
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
