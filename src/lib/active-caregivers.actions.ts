
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import Papa from 'papaparse';
import { format, parse as dateParse } from 'date-fns';

export async function processActiveCaregiverUpload(csvText: string) {
  const firestore = serverDb;
  const now = Timestamp.now();
  
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const rows: Record<string, string>[] = parsed.data as Record<string, string>[];
  const headers = parsed.meta.fields || [];

  if (rows.length < 2) {
    return { message: "CSV must have at least a header row and one data row.", error: true, caregiversFound: [] };
  }
  
  try {
    const allCaregiverNames = new Set<string>();
    rows.forEach(row => {
        headers.forEach(header => {
            const cellValue = row[header]?.trim();
            if (cellValue && !cellValue.includes("Scheduled Availability") && cellValue !== "Total H's") {
                allCaregiverNames.add(cellValue);
            }
        });
    });

    const caregiverNameArray = Array.from(allCaregiverNames);
    const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();

    const CHUNK_SIZE = 30;
    for (let i = 0; i < caregiverNameArray.length; i += CHUNK_SIZE) {
        const chunk = caregiverNameArray.slice(i, i + CHUNK_SIZE);
        const querySnapshot = await firestore.collection('caregivers_active').where('Name', 'in', chunk).get();
        querySnapshot.forEach(doc => {
            profileMap.set(doc.data().Name, doc.ref);
        });
    }

    let batch = firestore.batch();
    let operations = 0;
    const weeklyData: { [caregiverId: string]: { [weekIdentifier: string]: any } } = {};
      
    // Iterate through each column (day) by its header
    for (const header of headers) {
        if (!header.trim()) continue;

        const [day, rawDate] = header.split('\n');
        if (!day || !rawDate) continue;

        const recordDate = dateParse(rawDate.trim(), 'M/d/yyyy', new Date());
        if (isNaN(recordDate.getTime())) continue;

        const weekIdentifier = `week_${format(recordDate, 'yyyy-ww')}`;
        const dayKey = format(recordDate, 'eeee').toLowerCase();

        let lastCaregiverName: string | null = null;
        
        // Iterate down the rows for the current column
        for (const row of rows) {
            const cellValue = row[header]?.trim();
            if (!cellValue || cellValue.includes("Total H's")) continue;

            if (!cellValue.includes("Scheduled Availability")) {
                lastCaregiverName = cellValue;
            } else {
                if (!lastCaregiverName) continue;
                
                const caregiverRef = profileMap.get(lastCaregiverName);
                if (caregiverRef) {
                    const timeMatch = cellValue.match(/(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
                    if (timeMatch) {
                        try {
                            const startTime = dateParse(timeMatch[1], 'h:mm:ss a', new Date());
                            const endTime = dateParse(timeMatch[2], 'h:mm:ss a', new Date());

                            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                                console.warn(`Invalid time format for caregiver ${lastCaregiverName}. Value: "${cellValue}"`);
                                continue;
                            }
                            
                            const formattedStartTime = format(startTime, 'HH:mm');
                            const formattedEndTime = format(endTime, 'HH:mm');

                            if (!weeklyData[caregiverRef.id]) weeklyData[caregiverRef.id] = {};
                            if (!weeklyData[caregiverRef.id][weekIdentifier]) {
                                weeklyData[caregiverRef.id][weekIdentifier] = {
                                    createdAt: now, updatedAt: now, caregiverId: caregiverRef.id, caregiverName: lastCaregiverName,
                                };
                            }
                            if (!weeklyData[caregiverRef.id][weekIdentifier][dayKey]) {
                                weeklyData[caregiverRef.id][weekIdentifier][dayKey] = [];
                            }
                            weeklyData[caregiverRef.id][weekIdentifier][dayKey].push(`${formattedStartTime} - ${formattedEndTime}`);

                        } catch (e: any) {
                            console.error(`CRITICAL: Could not parse time for caregiver ${lastCaregiverName} on ${rawDate}. Value: "${cellValue}". Error: ${e.message}`);
                            throw new Error(`Invalid time value found for ${lastCaregiverName}. Please check the format in your CSV.`);
                        }
                    }
                }
            }
        }
    }

    for (const caregiverId in weeklyData) {
        for (const weekId in weeklyData[caregiverId]) {
            const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverId).collection('availability').doc(weekId);
            batch.set(availabilityDocRef, weeklyData[caregiverId][weekId], { merge: true });
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
    return { message: `Availability updated for ${Object.keys(weeklyData).length} caregivers.`, caregiversFound: Array.from(allCaregiverNames) };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true, caregiversFound: [] };
  }
}
