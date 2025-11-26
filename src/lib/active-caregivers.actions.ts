
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import { format, parse as dateParse } from 'date-fns';

// Helper function to robustly parse 12-hour AM/PM time strings to 24-hour format
function parseTo24HourFormat(timeStr: string): string | null {
    if (!timeStr) return null;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch) {
        console.warn(`[Time Parser] Could not match time format for: "${timeStr}"`);
        return null;
    }

    let [_, hours, minutes, seconds, ampm] = timeMatch;
    let hour = parseInt(hours, 10);

    if (ampm.toUpperCase() === 'PM' && hour < 12) {
        hour += 12;
    }
    if (ampm.toUpperCase() === 'AM' && hour === 12) {
        hour = 0; // Midnight case
    }

    return `${String(hour).padStart(2, '0')}:${minutes}`;
}


export async function processActiveCaregiverUpload(rows: Record<string, any>[]) {
  const firestore = serverDb;
  const now = Timestamp.now();
  
  if (!rows || rows.length < 2) { // Need at least header, caregiver name, and availability row
    return { message: "CSV is missing necessary data rows.", error: true };
  }

  const headers = Object.keys(rows[0]);
  
  try {
    const allCaregiverNames = new Set<string>();
    for (let i = 0; i < rows.length - 1; i++) {
        const nameCell = rows[i][headers[0]]?.trim();
        // Check if the current row looks like a caregiver name row
        if (nameCell && nameCell !== "Total H's" && !nameCell.includes("Scheduled Availability")) {
            allCaregiverNames.add(nameCell);
        }
    }

    const caregiverNameArray = Array.from(allCaregiverNames);
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

    for (let i = 0; i < rows.length - 1; i++) {
        const currentNameRow = rows[i];
        const nextAvailabilityRow = rows[i+1];
        const caregiverName = currentNameRow[headers[0]]?.trim();

        if (caregiverName && caregiverName !== "Total H's" && !caregiverName.includes("Scheduled Availability")) {
            const caregiverRef = profileMap.get(caregiverName);
            if (!caregiverRef) continue;

            headers.forEach(header => {
                if (!header.trim() || header === headers[0]) return; // Skip name column

                const headerParts = header.split('\n');
                if (headerParts.length < 2) return;

                const rawDate = headerParts[1];
                if (!rawDate) return;

                const recordDate = dateParse(rawDate.trim(), 'M/d/yyyy', new Date());
                if (isNaN(recordDate.getTime())) return;

                const weekIdentifier = `week_${format(recordDate, 'yyyy-ww')}`;
                const dayKey = format(recordDate, 'eeee').toLowerCase();
                const availabilityCell = nextAvailabilityRow[header]?.trim();
                
                if (availabilityCell && availabilityCell.includes("Scheduled Availability")) {
                    const timeLine = availabilityCell.split('\n').find(l => l.includes("To"));
                     if (timeLine) {
                         const timeParts = timeLine.split("To").map(t => t.trim());
                         if (timeParts.length === 2) {
                             const formattedStartTime = parseTo24HourFormat(timeParts[0]);
                             const formattedEndTime = parseTo24HourFormat(timeParts[1]);

                             if (formattedStartTime && formattedEndTime) {
                                if (!weeklyData[caregiverRef.id]) weeklyData[caregiverRef.id] = {};
                                if (!weeklyData[caregiverRef.id][weekIdentifier]) {
                                    weeklyData[caregiverRef.id][weekIdentifier] = { createdAt: now, caregiverId: caregiverRef.id, caregiverName: caregiverName };
                                }
                                if (!weeklyData[caregiverRef.id][weekIdentifier][dayKey]) {
                                    weeklyData[caregiverRef.id][weekIdentifier][dayKey] = [];
                                }
                                const timeSlotString = `${formattedStartTime} - ${formattedEndTime}`;
                                weeklyData[caregiverRef.id][weekIdentifier][dayKey].push(timeSlotString);
                             }
                         }
                     }
                }
            });
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
                    dataToSet[day] = []; // Ensure empty days are explicitly cleared to overwrite old data
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
