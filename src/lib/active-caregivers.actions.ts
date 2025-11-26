
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import Papa from 'papaparse';
import { format, parse as dateParse } from 'date-fns';

function createCompositeKey(name: string, mobile: string, address: string, city: string): string {
    const normalizedName = (name || '').trim().toLowerCase();
    const normalizedMobile = (mobile || '').replace(/\D/g, ''); // Remove non-digits
    const normalizedAddress = (address || '').trim().toLowerCase();
    const normalizedCity = (city || '').trim().toLowerCase();
    return `${normalizedName}|${normalizedMobile}|${normalizedAddress}|${normalizedCity}`;
}

export async function processActiveCaregiverUpload(data: Record<string, any>[]) {
  console.log(`[Action Start] processActiveCaregiverUpload received ${data.length} rows.`);
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();

  try {
    const existingCaregiversSnap = await caregiversCollection.where('status', '==', 'Active').get();
    const existingCaregiversMap = new Map<string, { id: string, data: any }>();
    existingCaregiversSnap.forEach(doc => {
      const docData = doc.data();
      const email = (docData.Email || '').trim().toLowerCase();
      if (email) {
        existingCaregiversMap.set(email, { id: doc.id, data: docData });
      }
    });
    console.log(`[Action] Found ${existingCaregiversMap.size} existing active caregivers.`);

    let batch: WriteBatch = firestore.batch();
    let operations = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const processedEmails = new Set<string>();

    for (const row of data) {
      const email = (row['Email'] || row['email'] || '').trim().toLowerCase();
      if (!email) {
        console.warn('[Action] Skipping row due to missing email:', row);
        continue;
      }
      processedEmails.add(email);
      
      const caregiverData = {
        'Name': row['Name'] || '',
        'dob': row['dob'] || '',
        'Address': row['Address'] || '',
        'Apt': row['Apt'] || '',
        'City': row['City'] || '',
        'State': row['State'] || '',
        'Zip': row['Zip'] || '',
        'Mobile': row['Mobile'] || '',
        'Hire Date': row['Hire Date'] || '',
        'Email': email,
        'Drivers Lic': row['Drivers Lic'] || '',
        'Caregiver Lic': row['Caregiver Lic'] || '',
        'TTiD-PIN': row['TTiD-PIN'] || '',
        status: 'Active',
        lastUpdatedAt: now,
      };

      const existingCaregiver = existingCaregiversMap.get(email);

      if (existingCaregiver) {
        const docRef = caregiversCollection.doc(existingCaregiver.id);
        batch.update(docRef, caregiverData);
        updatedCount++;
        existingCaregiversMap.delete(email);
      } else {
        const query = caregiversCollection.where('Email', '==', email).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            const docRef = caregiversCollection.doc();
            batch.set(docRef, { ...caregiverData, createdAt: now });
            createdCount++;
        } else {
            const docRef = snapshot.docs[0].ref;
            batch.update(docRef, caregiverData);
            updatedCount++;
        }
      }

      operations++;
      if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

    let deactivatedCount = 0;
    for (const [email, { id }] of existingCaregiversMap.entries()) {
        console.log(`[Action] Deactivating caregiver not in CSV: ${email}`);
        const docRef = caregiversCollection.doc(id);
        batch.update(docRef, { status: 'Inactive', lastUpdatedAt: now });
        deactivatedCount++;
        operations++;
        if (operations >= 499) {
            await batch.commit();
            batch = firestore.batch();
            operations = 0;
        }
    }

    if (operations > 0) {
      await batch.commit();
    }

    const message = `Upload complete. Created: ${createdCount}, Updated: ${updatedCount}, Deactivated: ${deactivatedCount}.`;
    console.log(`[Action Success] ${message}`);
    revalidatePath('/admin/manage-active-caregivers');
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: message };

  } catch (error: any) {
    console.error('[Action Error] Critical error during upload process:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}

export async function processCaregiverAvailabilityUpload(csvText: string) {
  const firestore = serverDb;
  const now = Timestamp.now();
  
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false });
  const rows: Record<string, string>[] = parsed.data as Record<string, string>[];
  const headers = parsed.meta.fields || [];

  if (rows.length < 2) {
    return { message: "CSV must have at least 2 rows for headers and data.", error: true };
  }
  
  try {
    const allCaregiverNames = new Set<string>();
    rows.forEach(row => {
        const firstColValue = row[headers[0]]?.trim();
        if (firstColValue && !firstColValue.includes("Scheduled Availability") && firstColValue !== "Total H's") {
            allCaregiverNames.add(firstColValue);
        }
    });

    if (allCaregiverNames.size === 0) {
        return { message: "No caregiver names found in the first column.", error: true };
    }

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
            if (!cellValue || cellValue === "Total H's") continue;

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
                                throw new Error(`Invalid time format for caregiver ${lastCaregiverName}. Value: "${cellValue}"`);
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
    return { message: `Availability updated for ${Object.keys(weeklyData).length} caregivers.` };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
