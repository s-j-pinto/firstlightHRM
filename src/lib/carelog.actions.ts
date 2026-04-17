

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { careLogSchema } from './types';
import { parse, isValid } from 'date-fns';

export async function saveAllstarWeeklyReport(payload: {
    logUpdates: { logId: string; visitData: any }[];
    adminData: any;
}) {
    const { logUpdates, adminData } = payload;
    const firestore = serverDb;

    if (!logUpdates || logUpdates.length === 0) {
        return { error: 'No logs found for the selected week to update.' };
    }

    try {
        const batch = firestore.batch();
        const now = Timestamp.now();

        // Prepare the admin data to be merged into each document
        const adminDataToSave: { [key: string]: any } = {
            'templateData.allstar_route_sheet.checkedBy': adminData.checkedBy || null,
            'templateData.allstar_route_sheet.remarks': adminData.remarks || null,
        };
        
        if (adminData.dateSubmitted && /^\d{2}\/\d{2}\/\d{4}$/.test(adminData.dateSubmitted)) {
            adminDataToSave['templateData.allstar_route_sheet.dateSubmitted'] = Timestamp.fromDate(parse(adminData.dateSubmitted, 'MM/dd/yyyy', new Date()));
        }
        if (adminData.checkedDate && /^\d{2}\/\d{2}\/\d{4}$/.test(adminData.checkedDate)) {
            adminDataToSave['templateData.allstar_route_sheet.checkedDate'] = Timestamp.fromDate(parse(adminData.checkedDate, 'MM/dd/yyyy', new Date()));
        }

        // Iterate through each log that needs updating
        for (const { logId, visitData } of logUpdates) {
            const logRef = firestore.collection('carelogs').doc(logId);
            
            // Prepare the visit-specific data
            const visitDataToSave: { [key: string]: any } = {};
            for (const key in visitData) {
                if (key === 'serviceDate' && visitData[key] && /^\d{2}\/\d{2}\/\d{4}$/.test(visitData[key])) {
                     visitDataToSave[`templateData.allstar_route_sheet.${key}`] = Timestamp.fromDate(parse(visitData[key], 'MM/dd/yyyy', new Date()));
                } else {
                     visitDataToSave[`templateData.allstar_route_sheet.${key}`] = visitData[key] || '';
                }
            }
            
            // Combine admin data, visit data, and timestamp for the update
            const finalUpdateData = {
                ...visitDataToSave,
                ...adminDataToSave,
                lastUpdatedAt: now
            };
            
            batch.update(logRef, finalUpdateData);
        }
        
        await batch.commit();

        revalidatePath(`/staffing-admin/reports/carelog`, 'layout');
        return { success: true, message: 'All changes for the week have been saved successfully.' };

    } catch (error: any) {
        console.error("Error saving Allstar weekly report:", error);
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
