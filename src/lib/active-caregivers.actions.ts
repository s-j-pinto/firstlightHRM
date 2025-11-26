
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
  
  const parsed = Papa.parse<any[]>(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const headers = parsed.meta.fields || [];

  if (rows.length < 2) {
      return { message: "CSV must have at least 2 rows (date headers and data).", error: true };
  }

  // First data row is the date header
  const dateHeaderRow = rows[0]; 

  const allCaregiverNames = new Set<string>();
  rows.slice(1).forEach(row => {
    const caregiverName = row[headers[0]]?.trim();
    if(caregiverName && caregiverName !== "Total H's") {
        allCaregiverNames.add(caregiverName);
    }
  });

  if (allCaregiverNames.size === 0) {
    return { message: "No caregiver names found in the first column of the CSV.", error: true };
  }

  try {
      const caregiverNameArray = Array.from(allCaregiverNames);
      const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();

      // Fetch caregiver profiles in chunks to avoid firestore limitations
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
      const updatedCaregivers = new Set<string>();
      const weeklyData: { [caregiverId: string]: { [weekIdentifier: string]: any } } = {};

      // Iterate through each data column (each day)
      for (const dayHeader of headers.slice(1)) {
          const dateStr = dateHeaderRow[dayHeader]?.trim();
          if (!dateStr) continue;

          let lastCaregiverName: string | null = null;
          
          // Iterate through rows for this specific day's column
          for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const cellValue = row[dayHeader]?.trim();
              const potentialCaregiverName = row[headers[0]]?.trim();

              if(potentialCaregiverName && potentialCaregiverName !== "Total H's") {
                  lastCaregiverName = potentialCaregiverName;
              }
              
              if (lastCaregiverName && cellValue && cellValue.toLowerCase().startsWith('scheduled availability')) {
                const caregiverRef = profileMap.get(lastCaregiverName);
                if (caregiverRef) {
                    const recordDate = dateParse(dateStr, 'M/d/yyyy', new Date());
                    const weekIdentifier = `week_${format(recordDate, 'yyyy-ww')}`;
                    const dayKey = format(recordDate, 'eeee').toLowerCase();

                     if (!weeklyData[caregiverRef.id]) {
                        weeklyData[caregiverRef.id] = {};
                    }
                    if (!weeklyData[caregiverRef.id][weekIdentifier]) {
                        weeklyData[caregiverRef.id][weekIdentifier] = {
                            createdAt: now,
                            updatedAt: now,
                            caregiverId: caregiverRef.id,
                            caregiverName: lastCaregiverName,
                        };
                    }
                    
                    if (!weeklyData[caregiverRef.id][weekIdentifier][dayKey]) {
                        weeklyData[caregiverRef.id][weekIdentifier][dayKey] = [];
                    }

                    const timeMatch = cellValue.match(/(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
                    if (timeMatch) {
                         try {
                            const startTimeStr = timeMatch[1];
                            const endTimeStr = timeMatch[2];
                            
                            let startTime = dateParse(startTimeStr, 'hh:mm:ss a', new Date());
                            if (isNaN(startTime.getTime())) startTime = dateParse(startTimeStr, 'h:mm:ss a', new Date());

                            let endTime = dateParse(endTimeStr, 'hh:mm:ss a', new Date());
                            if (isNaN(endTime.getTime())) endTime = dateParse(endTimeStr, 'h:mm:ss a', new Date());

                            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                                throw new Error(`Invalid time format. Could not parse '${startTimeStr}' or '${endTimeStr}'.`);
                            }
                            
                            const formattedStartTime = format(startTime, 'HH:mm');
                            const formattedEndTime = format(endTime, 'HH:mm');
                        
                            weeklyData[caregiverRef.id][weekIdentifier][dayKey].push(`${formattedStartTime} - ${formattedEndTime}`);
                            updatedCaregivers.add(lastCaregiverName);
                        } catch (e: any) {
                            console.error(`CRITICAL: Could not parse time for caregiver ${lastCaregiverName} on ${dateStr}. Value: "${cellValue}". Error: ${e.message}`);
                            throw new Error(`Invalid time value found for ${lastCaregiverName} on ${dateStr}. Please check the format in your CSV.`);
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

      const notFoundNames = caregiverNameArray.filter(name => !profileMap.has(name));
      let message = `Availability updated for ${updatedCaregivers.size} caregivers.`;
      if (notFoundNames.length > 0) {
          message += ` Could not find active profiles for ${notFoundNames.length} names: ${notFoundNames.slice(0, 5).join(', ')}...`;
      }
      
      revalidatePath('/staffing-admin/manage-active-caregivers');
      return { message };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
