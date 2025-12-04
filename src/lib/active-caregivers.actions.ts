
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
        const trimmedName = name.trim();
        profileMap.set(trimmedName, doc.ref);
        
        // Also map "Last, First" to the same ref if it's different
        if (trimmedName.includes(', ')) {
            const parts = trimmedName.split(', ');
            if(parts.length === 2) {
                const reversedName = `${parts[1]} ${parts[0]}`;
                if (!profileMap.has(reversedName)) {
                    profileMap.set(reversedName, doc.ref);
                }
            }
        } else if (trimmedName.includes(' ')) {
             const parts = trimmedName.split(' ');
             if(parts.length > 1) {
                const lastName = parts.pop();
                const firstName = parts.join(' ');
                const reversedName = `${lastName}, ${firstName}`;
                 if (!profileMap.has(reversedName)) {
                    profileMap.set(reversedName, doc.ref);
                }
             }
        }
      }
    });
    console.log(`[Action] Built profile map with ${profileMap.size} name variations.`);

    let batch = firestore.batch();
    let operations = 0;
    let caregiversUpdatedCount = 0;

    for (const caregiver of caregivers) {
        const caregiverRef = profileMap.get(caregiver.name.trim());
        if (!caregiverRef) {
            console.warn(`[Action] Could not find active caregiver profile for name: "${caregiver.name.trim()}"`);
            continue;
        }

        const availabilityData: { [key: string]: any } = {
            caregiverId: caregiverRef.id,
            caregiverName: caregiver.name,
            lastUpdatedAt: now,
        };

        let hasData = false;
        console.log(`[Action] Processing schedule for: ${caregiver.name}`);

        for (const day in caregiver.schedule) {
            const dayKey = day.toLowerCase();
            const cellText = caregiver.schedule[day];
            const timeSlots: string[] = [];
            
            if(cellText) {
                const availabilityEntries = cellText.split(/\n\n+/).filter(e => e.trim());
                 console.log(`[Action] Day: ${day}, Entries Found: ${availabilityEntries.length}`);
                
                for(const entry of availabilityEntries) {
                    // Use a regex to find the time range more reliably
                    const timeRangeMatch = entry.match(/(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/i);

                    if (timeRangeMatch) {
                        const startTimeStr = timeRangeMatch[1];
                        const endTimeStr = timeRangeMatch[2];
                        const formattedStartTime = parseTo24HourFormat(startTimeStr);
                        const formattedEndTime = parseTo24HourFormat(endTimeStr);
                        
                        if (formattedStartTime && formattedEndTime) {
                           timeSlots.push(`${formattedStartTime} - ${formattedEndTime}`);
                           console.log(`[Action] ... Parsed and added slot: ${formattedStartTime} - ${formattedEndTime}`);
                        }
                    } else {
                        console.warn(`[Action] ... Could not parse time range from entry: "${entry}"`);
                    }
                }
            }
            availabilityData[dayKey] = timeSlots;
            if(timeSlots.length > 0) hasData = true;
        }
        
        if (hasData) {
            console.log(`[Action] Data found for ${caregiver.name}. Preparing to update Firestore.`);
            const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverRef.id).collection('availability').doc('current_week');
            batch.set(availabilityDocRef, availabilityData, { merge: true });
            operations++;
            caregiversUpdatedCount++;
        } else {
             console.log(`[Action] No valid data found for ${caregiver.name}. Skipping update.`);
        }
    }
    
    if (operations > 0) {
        console.log(`[Action] Committing batch with ${operations} operations.`);
        await batch.commit();
    } else {
        console.log('[Action] No operations to commit.');
    }
    
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Processed availability for ${caregivers.length} caregivers. Updated ${caregiversUpdatedCount} records.` };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
