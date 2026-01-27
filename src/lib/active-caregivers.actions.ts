
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import { parse, differenceInMinutes } from 'date-fns';

const DAY_COLUMNS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

function parse12Hour(timeStr: string): Date | null {
  try {
    return parse(timeStr, 'h:mm:ss a', new Date());
  } catch (e) {
    console.warn(`[Time Parser] Failed to parse time: "${timeStr}"`);
    return null;
  }
}

function calculateDurationInHours(startStr: string, endStr: string): number {
  const startDate = parse12Hour(startStr);
  const endDate = parse12Hour(endStr);

  if (startDate && endDate) {
    let diff = differenceInMinutes(endDate, startDate);
    // Handle overnight shifts by assuming they cross a single midnight
    if (diff < 0) {
      diff += 24 * 60; // Add 24 hours in minutes
    }
    return diff / 60;
  }
  return 0;
}

export async function processActiveCaregiverAvailabilityUpload(caregiversData: { name: string; schedule: Record<string, string> }[]) {
  const firestore = serverDb;
  const now = Timestamp.now();
  
  if (!caregiversData || caregiversData.length === 0) {
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
        
        if (trimmedName.includes(', ')) {
            const parts = trimmedName.split(', ');
            if(parts.length === 2) {
                profileMap.set(`${parts[1]} ${parts[0]}`, doc.ref);
            }
        } else if (trimmedName.includes(' ')) {
             const parts = trimmedName.split(' ');
             if(parts.length > 1) {
                const lastName = parts.pop()!;
                const firstName = parts.join(' ');
                profileMap.set(`${lastName}, ${firstName}`, doc.ref);
             }
        }
      }
    });

    let batch = firestore.batch();
    let operations = 0;
    let caregiversUpdatedCount = 0;

    for (const caregiver of caregiversData) {
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

        for (const day of DAY_COLUMNS) {
            let cellText = (caregiver.schedule[day] || '').trim();
            if (!cellText) {
                availabilityData[day.toLowerCase()] = { schedule: '', nonOvertimeHours: 0, totalShiftHours: 0, hasAvailabilityBlock: false };
                continue;
            }

            // Sanitize to handle messy CSV data by adding spaces
            cellText = cellText
                .replace(/([a-zA-Z])(\d{1,2}:\d{2}:\d{2})/g, '$1 $2') // Add space between letters and numbers
                .replace(/([AP]M)(?=[a-zA-Z\d])/g, '$1 ') // Add space after AM/PM if followed by letter/number
                .replace(/\s*-\s*/g, ' - '); // Ensure spaces around hyphens

            let totalAvailabilityHours = 0;
            const availabilityRegex = /Scheduled Availability\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi;
            let availabilityMatch;
            while ((availabilityMatch = availabilityRegex.exec(cellText)) !== null) {
                totalAvailabilityHours += calculateDurationInHours(availabilityMatch[1], availabilityMatch[2]);
            }
            const hasAvailabilityBlock = totalAvailabilityHours > 0;
            const cappedAvailability = Math.min(totalAvailabilityHours, 9);

            let totalShiftHours = 0;
            const shiftRegex = /(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi;
            let shiftMatch;
            while ((shiftMatch = shiftRegex.exec(cellText)) !== null) {
                totalShiftHours += calculateDurationInHours(shiftMatch[1], shiftMatch[2]);
            }
            
            const nonOvertimeHours = hasAvailabilityBlock ? (cappedAvailability - totalShiftHours) : (0 - totalShiftHours);
            
            availabilityData[day.toLowerCase()] = {
              schedule: cellText.replace(/\r/g, ""),
              nonOvertimeHours: parseFloat(nonOvertimeHours.toFixed(2)),
              totalShiftHours: parseFloat(totalShiftHours.toFixed(2)),
              hasAvailabilityBlock: hasAvailabilityBlock,
            };
        }
        
        const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverRef.id).collection('availability').doc('current_week');
        batch.set(availabilityDocRef, availabilityData, { merge: true });
        operations++;
        caregiversUpdatedCount++;
    }
    
    if (operations > 0) {
        await batch.commit();
    }
    
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Processed availability for ${caregiversData.length} caregivers. Updated ${caregiversUpdatedCount} records.` };

  } catch (error: any) {
      console.error('[Action Error] Critical error during availability upload:', error);
      return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}

function createCaregiverCompositeKey(name: string, mobile: string, address: string): string {
    const normalizedName = (name || '').trim().toLowerCase();
    const normalizedMobile = (mobile || '').replace(/\D/g, ''); // Remove non-digits
    const normalizedAddress = (address || '').trim().toLowerCase();
    return `${normalizedName}|${normalizedMobile}|${normalizedAddress}`;
}


export async function processActiveCaregiverProfiles(data: Record<string, any>[]) {
  console.log(`[Action Start] processActiveCaregiverProfiles received ${data.length} rows.`);
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();

  try {
    // 1. Fetch all existing caregivers to compare against
    const existingCaregiversSnap = await caregiversCollection.get();
    const existingCaregiversMap = new Map<string, { id: string, data: any }>();
    
    existingCaregiversSnap.forEach(doc => {
      const docData = doc.data();
      const key = createCaregiverCompositeKey(docData['Name'], docData['Mobile'], docData['Address']);
      if (key !== '||') {
        existingCaregiversMap.set(key, { id: doc.id, data: docData });
      }
    });
    console.log(`[Action] Found ${existingCaregiversMap.size} existing caregivers.`);

    let batch: WriteBatch = firestore.batch();
    let operations = 0;
    let createdCount = 0;
    let updatedCount = 0;
    
    // 2. Iterate through uploaded CSV data
    for (const row of data) {
      const caregiverName = row['Name'];
      const mobile = row['Mobile'];
      const address = row['Address'];
      const compositeKey = createCaregiverCompositeKey(caregiverName, mobile, address);

      if (compositeKey === '||') {
        console.warn('[Action] Skipping row due to missing "Name", "Mobile", or "Address":', row);
        continue;
      }
      
      const caregiverData = {
        'Name': caregiverName,
        'dob': row['dob'] || '',
        'Address': address || '',
        'Apt': row['Apt'] || '',
        'City': row['City'] || '',
        'State': row['State'] || '',
        'Zip': row['Zip'] || '',
        'Mobile': mobile,
        'Hire Date': row['Hire Date'] || '',
        'Email': row['Email'] || '',
        'Drivers Lic': row['Drivers Lic'] || '',
        'Caregiver Lic': row['Caregiver Lic'] || '',
        'TTiD-PIN': row['TTiD-PIN'] || '',
        'status': 'Active',
        'lastUpdatedAt': now,
      };

      const existingCaregiver = existingCaregiversMap.get(compositeKey);

      if (existingCaregiver) {
        // Update existing record
        const docRef = caregiversCollection.doc(existingCaregiver.id);
        batch.update(docRef, caregiverData);
        updatedCount++;
        // Remove from map so we know it's been processed
        existingCaregiversMap.delete(compositeKey);
      } else {
        // Create new record
        const docRef = caregiversCollection.doc(); // Let Firestore generate ID
        batch.set(docRef, { ...caregiverData, createdAt: now });
        createdCount++;
      }

      operations++;
      if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

    // 3. Deactivate caregivers not present in the new upload
    for (const [key, { id }] of existingCaregiversMap.entries()) {
      console.log(`[Action] Deactivating caregiver not in CSV: ${key}`);
      const docRef = caregiversCollection.doc(id);
      batch.update(docRef, { status: 'Inactive', lastUpdatedAt: now });
      operations++;
       if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }
    const deactivatedCount = existingCaregiversMap.size;

    // 4. Commit any remaining operations in the batch
    if (operations > 0) {
      await batch.commit();
    }

    const message = `Upload complete. Created: ${createdCount}, Updated: ${updatedCount}, Deactivated: ${deactivatedCount}.`;
    console.log(`[Action Success] ${message}`);
    revalidatePath('/admin/manage-active-caregivers');
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message };

  } catch (error: any) {
    console.error('[Action Error] Critical error during caregiver profile upload process:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}


export async function processActiveCaregiverPreferencesUpload(data: Record<string, any>[]) {
    const firestore = serverDb;
    const now = Timestamp.now();

    if (!data || data.length === 0) {
        return { message: "No preference data was processed from the CSV.", error: true };
    }

    try {
        const allCaregiversSnap = await firestore.collection('caregivers_active').where('status', '==', 'Active').get();
        const profileMap = new Map<string, string>(); // Map name to caregiver document ID

        allCaregiversSnap.forEach(doc => {
            const name = doc.data().Name;
            if (name) {
                profileMap.set(name.trim(), doc.id);
            }
        });

        let batch = firestore.batch();
        let operations = 0;
        let updatedCount = 0;

        for (const row of data) {
            const caregiverName = row['Caregiver']?.trim();
            if (!caregiverName) continue;

            const caregiverId = profileMap.get(caregiverName);
            if (!caregiverId) {
                console.warn(`[Preferences] Could not find active caregiver profile for name: "${caregiverName}"`);
                continue;
            }

            const { Caregiver, ...preferences } = row;
            const preferencesData = {
                ...preferences,
                caregiverId: caregiverId,
                lastUpdatedAt: now,
            };

            const preferencesDocRef = firestore.collection('caregivers_active').doc(caregiverId).collection('preferences').doc('current');
            batch.set(preferencesDocRef, preferencesData, { merge: true });
            operations++;
            updatedCount++;

            if (operations >= 499) {
                await batch.commit();
                batch = firestore.batch();
                operations = 0;
            }
        }

        if (operations > 0) {
            await batch.commit();
        }

        revalidatePath('/staffing-admin/manage-active-caregivers');
        return { message: `Preferences upload finished. Updated ${updatedCount} caregiver records.` };

    } catch (error: any) {
        console.error('[Action Error] Critical error during preferences upload:', error);
        return { message: `An error occurred during the preferences upload: ${error.message}`, error: true };
    }
}
