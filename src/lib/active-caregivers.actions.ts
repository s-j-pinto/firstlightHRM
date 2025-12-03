
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import { format, parse as dateParse } from 'date-fns';

// Helper function to robustly parse 12-hour AM/PM time strings to 24-hour format
function parseTo24HourFormat(timeStr: string): string | null {
    if (!timeStr) return null;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i) || timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) {
        console.warn(`[Time Parser] Could not match time format for: "${timeStr}"`);
        return null;
    }

    let [_, hours, minutes, ampm] = timeMatch;
    // If seconds are present, they are ignored for the 24-hour format string
    
    let hour = parseInt(hours, 10);

    if (ampm.toUpperCase() === 'PM' && hour < 12) {
        hour += 12;
    }
    if (ampm.toUpperCase() === 'AM' && hour === 12) {
        hour = 0; // Midnight case
    }

    return `${String(hour).padStart(2, '0')}:${minutes}`;
}


export async function processActiveCaregiverUpload(caregivers: { name: string; schedule: Record<string, any>[] }[]) {
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
    const weeklyData: { [caregiverId: string]: { [weekIdentifier: string]: any } } = {};

    for (const caregiver of caregivers) {
        const caregiverRef = profileMap.get(caregiver.name);
        if (!caregiverRef) continue;

        for (const scheduleRow of caregiver.schedule) {
            
            for (const header in scheduleRow) {
                if (!Object.prototype.hasOwnProperty.call(scheduleRow, header)) continue;

                const dateMatch = header.match(/\n(\d{1,2}\/\d{1,2}\/\d{4})/);
                if (!dateMatch) continue;

                const scheduleDateString = dateMatch[1];
                const recordDate = dateParse(scheduleDateString, 'MM/dd/yyyy', new Date());
                if (isNaN(recordDate.getTime())) continue;

                const weekIdentifier = `week_${format(recordDate, 'yyyy-ww')}`;
                const dayKey = format(recordDate, 'eeee').toLowerCase();

                const availabilityCell = scheduleRow[header];
                if (!availabilityCell || typeof availabilityCell !== 'string') continue;
                
                const daySlots: string[] = [];
                const timeSlots = availabilityCell.split(',');

                for (const slot of timeSlots) {
                    const matches = slot.match(/Available\s*(.*?)\s*To\s*(.*)/i);
                    if (matches && matches.length === 3) {
                        const formattedStartTime = parseTo24HourFormat(matches[1].trim());
                        const formattedEndTime = parseTo24HourFormat(matches[2].trim());
                        if (formattedStartTime && formattedEndTime) {
                            daySlots.push(`${formattedStartTime} - ${formattedEndTime}`);
                        }
                    }
                }
                
                if (daySlots.length > 0) {
                    if (!weeklyData[caregiverRef.id]) weeklyData[caregiverRef.id] = {};
                    if (!weeklyData[caregiverRef.id][weekIdentifier]) {
                        weeklyData[caregiverRef.id][weekIdentifier] = { createdAt: now, caregiverId: caregiverRef.id, caregiverName: caregiver.name };
                    }
                     if (!weeklyData[caregiverRef.id][weekIdentifier][dayKey]) {
                        weeklyData[caregiverRef.id][weekIdentifier][dayKey] = [];
                    }
                    weeklyData[caregiverRef.id][weekIdentifier][dayKey].push(...daySlots);
                }
            }
        }
    }

    let updatedCaregiverCount = 0;
    for (const caregiverId in weeklyData) {
        updatedCaregiverCount++;
        for (const weekId in weeklyData[caregiverId]) {
            const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverId).collection('availability').doc(weekId);
            const dataToSet = weeklyData[caregiverId][weekId];
            dataToSet.lastUpdatedAt = now;
            
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            days.forEach(day => {
                if (!dataToSet[day]) {
                    dataToSet[day] = []; // Ensure empty days are explicitly cleared
                } else {
                    // Remove duplicates
                    dataToSet[day] = [...new Set(dataToSet[day])];
                }
            });

            batch.set(availabilityDocRef, dataToSet, { merge: true });
            operations++;

            if (operations >= 499) {
                await batch.commit();
                batch = firestore.batch();
                operations = 0;
            }
        }
    }

    if (operations > 0) {
        await batch.commit();
    }
    
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Processed availability for ${updatedCaregiverCount} caregivers.` };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
