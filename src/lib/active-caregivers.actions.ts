
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';

// Helper function to robustly parse 12-hour AM/PM time strings to 24-hour format
function parseTo24HourFormat(timeStr: string): string | null {
    if (!timeStr) return null;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
    if (!timeMatch) {
        console.warn(`[Time Parser] Could not match time format for: "${timeStr}"`);
        return null;
    }

    let [_, hours, minutes, ampm] = timeMatch;
    let hour = parseInt(hours, 10);

    if (ampm.toUpperCase() === 'PM' && hour < 12) {
        hour += 12;
    }
    if (ampm.toUpperCase() === 'AM' && hour === 12) {
        hour = 0; // Midnight case
    }

    return `${String(hour).padStart(2, '0')}:${minutes}`;
}


export async function processActiveCaregiverUpload(caregivers: { name: string; schedule: Record<string, string> }[]) {
  const firestore = serverDb;
  const now = Timestamp.now();
  
  if (!caregivers || caregivers.length === 0) {
    return { message: "No valid caregiver data was processed from the CSV.", error: true };
  }

  try {
    const caregiverNameArray = caregivers.map(c => c.name);
    const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();
    
    if (caregiverNameArray.length > 0) {
        const CHUNK_SIZE = 30;
        for (let i = 0; i < caregiverNameArray.length; i += CHUNK_SIZE) {
            const chunk = caregiverNameArray.slice(i, i + CHUNK_SIZE);
            const querySnapshot = await firestore.collection('caregivers_active').where('Name', 'in', chunk).get();
            querySnapshot.forEach(doc => {
                profileMap.set(doc.data().Name, doc.ref);
            });
        }
    } else {
        return { message: "No caregiver names could be identified from the CSV.", error: true };
    }

    let batch = firestore.batch();
    let operations = 0;

    for (const caregiver of caregivers) {
        const caregiverRef = profileMap.get(caregiver.name);
        if (!caregiverRef) continue;

        const availabilityData: { [key: string]: any } = {
            caregiverId: caregiverRef.id,
            caregiverName: caregiver.name,
            lastUpdatedAt: now,
        };

        let hasData = false;
        for (const day in caregiver.schedule) {
            const dayKey = day.toLowerCase();
            const cellText = caregiver.schedule[day];
            const timeSlots: string[] = [];
            
            if(cellText) {
                const availabilityEntries = cellText.split(/\n\n|\n/); // Split by double or single newlines
                for(const entry of availabilityEntries) {
                    const matches = entry.match(/(Available|Scheduled Availability)\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/i);
                    if (matches) {
                        const formattedStartTime = parseTo24HourFormat(matches[2].trim());
                        const formattedEndTime = parseTo24HourFormat(matches[3].trim());
                         if (formattedStartTime && formattedEndTime) {
                            timeSlots.push(`${formattedStartTime} - ${formattedEndTime}`);
                        }
                    }
                }
            }
            availabilityData[dayKey] = timeSlots;
            if(timeSlots.length > 0) hasData = true;
        }

        if (hasData) {
            // Since the CSV doesn't have a week identifier, we'll overwrite a "current" record.
            const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverRef.id).collection('availability').doc('current_week');
            batch.set(availabilityDocRef, availabilityData, { merge: true });
            operations++;
        }
    }

    if (operations > 0) {
        await batch.commit();
    }
    
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Processed availability for ${operations} caregivers.` };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
