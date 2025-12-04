
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
    const allCaregiversSnap = await firestore.collection('caregivers_active').where('status', '==', 'Active').get();
    const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();

    allCaregiversSnap.forEach(doc => {
        const name = doc.data().Name;
        if (name) {
            // Key by "Last, First"
            profileMap.set(name.trim(), doc.ref);
            
            // Also key by "First Last" if possible
            const parts = name.split(',').map((p: string) => p.trim());
            if (parts.length === 2) {
                const firstNameFirst = `${parts[1]} ${parts[0]}`;
                profileMap.set(firstNameFirst, doc.ref);
            }
        }
    });

    let batch = firestore.batch();
    let operations = 0;
    let caregiversUpdatedCount = 0;

    for (const caregiver of caregivers) {
        const caregiverRef = profileMap.get(caregiver.name);
        if (!caregiverRef) {
            console.warn(`[Action] Could not find active caregiver profile for name: "${caregiver.name}"`);
            continue;
        }

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
                // Split by one or more newlines to handle various spacings
                const availabilityEntries = cellText.split(/\n+/).filter(e => e.trim());
                
                let currentType = '';
                let tempStartTime = '';
                
                for(const entry of availabilityEntries) {
                    if (entry.startsWith('Available') || entry.startsWith('Scheduled Availability')) {
                        currentType = entry.trim();
                    } else if (entry.includes('To')) {
                         const timeParts = entry.split('To');
                         if (timeParts.length === 2) {
                             const startTimeStr = timeParts[0].trim();
                             const endTimeStr = timeParts[1].trim();

                             const formattedStartTime = parseTo24HourFormat(startTimeStr);
                             const formattedEndTime = parseTo24HourFormat(endTimeStr);
                             
                             if (formattedStartTime && formattedEndTime) {
                                timeSlots.push(`${currentType}: ${formattedStartTime} - ${formattedEndTime}`);
                             }
                         }
                    }
                }
            }
            availabilityData[dayKey] = timeSlots;
            if(timeSlots.length > 0) hasData = true;
        }
        
        if (hasData) {
            const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverRef.id).collection('availability').doc('current_week');
            batch.set(availabilityDocRef, availabilityData, { merge: true });
            operations++;
        }
    }
    
    caregiversUpdatedCount = operations;

    if (operations > 0) {
        await batch.commit();
    }
    
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Processed availability for ${caregiversUpdatedCount} caregivers.` };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
