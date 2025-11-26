
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import Papa from 'papaparse';
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


export async function processActiveCaregiverUpload(csvText: string) {
  const firestore = serverDb;
  const now = Timestamp.now();
  
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows: Record<string, string>[] = parsed.data as Record<string, string>[];
  const headers = parsed.meta.fields || [];

  if (rows.length < 2) { // Need at least header, caregiver name, and availability row
    return { message: "CSV is missing necessary data rows.", error: true, caregiversFound: [] };
  }
  
  try {
    const allCaregiverNames = new Set<string>();
    rows.forEach(row => {
        const nameCell = row[headers[0]]?.trim();
        if (nameCell && !nameCell.includes("Scheduled Availability") && nameCell !== "Total H's") {
            allCaregiverNames.add(nameCell);
        }
    });

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
        return { message: "No caregiver names could be identified from the first column of the CSV.", error: true, caregiversFound: [] };
    }

    let batch = firestore.batch();
    let operations = 0;
    const weeklyData: { [caregiverId: string]: { [weekIdentifier: string]: any } } = {};
    const debugPreview: { name: string, data: string[] }[] = [];

    // This loop mirrors the provided Node.js logic
    headers.forEach(header => {
        if (!header.trim() || header.toLowerCase() === 'care giver') return;

        const headerParts = header.split('\n');
        if (headerParts.length < 2) return; // Skip invalid headers

        const rawDate = headerParts[1];
        if (!rawDate) return;
        
        const recordDate = dateParse(rawDate.trim(), 'M/d/yyyy', new Date());
        if (isNaN(recordDate.getTime())) return;
        
        const weekIdentifier = `week_${format(recordDate, 'yyyy-ww')}`;
        const dayKey = format(recordDate, 'eeee').toLowerCase();

        let lastCaregiverName: string | null = null;

        rows.forEach(row => {
            const nameCell = row[headers[0]]?.trim();
            const availabilityCell = row[header]?.trim();

            if (nameCell && !nameCell.includes("Scheduled Availability") && nameCell !== "Total H's") {
                lastCaregiverName = nameCell;
            }

            if (lastCaregiverName && availabilityCell && availabilityCell.includes("Scheduled Availability")) {
                 const caregiverRef = profileMap.get(lastCaregiverName);
                 if (caregiverRef) {
                     const timeLine = availabilityCell.split('\n').find(l => l.includes("To"));
                     if (timeLine) {
                         const timeParts = timeLine.split("To").map(t => t.trim());
                         if (timeParts.length === 2) {
                             const formattedStartTime = parseTo24HourFormat(timeParts[0]);
                             const formattedEndTime = parseTo24HourFormat(timeParts[1]);

                             if (formattedStartTime && formattedEndTime) {
                                if (!weeklyData[caregiverRef.id]) weeklyData[caregiverRef.id] = {};
                                if (!weeklyData[caregiverRef.id][weekIdentifier]) {
                                    weeklyData[caregiverRef.id][weekIdentifier] = { createdAt: now, caregiverId: caregiverRef.id, caregiverName: lastCaregiverName };
                                }
                                if (!weeklyData[caregiverRef.id][weekIdentifier][dayKey]) {
                                    weeklyData[caregiverRef.id][weekIdentifier][dayKey] = [];
                                }
                                const timeSlotString = `${formattedStartTime} - ${formattedEndTime}`;
                                weeklyData[caregiverRef.id][weekIdentifier][dayKey].push(timeSlotString);

                                // Add to debug preview
                                const debugEntry = debugPreview.find(e => e.name === lastCaregiverName);
                                const debugString = `${dayKey}: ${timeSlotString}`;
                                if (debugEntry) {
                                    if(debugEntry.data.length < 5) debugEntry.data.push(debugString);
                                } else {
                                    if (debugPreview.length < 5) {
                                        debugPreview.push({ name: lastCaregiverName, data: [debugString] });
                                    }
                                }
                             }
                         }
                     }
                 }
            }
        });
    });

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
    return { message: `Upload finished. Attempted to process availability for ${updatedCaregiverCount} caregivers.`, debugPreview: debugPreview };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true, debugPreview: [] };
  }
}
