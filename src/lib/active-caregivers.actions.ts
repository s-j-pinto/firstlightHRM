
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
    // Robustly handle varying formats: "7:00:00 AM", "07:00:00 AM", "7:00 AM"
    let cleaned = timeStr.trim().toUpperCase();
    
    // If it's HH:mm AM, add the :00 for seconds to match the parser
    if (/^\d{1,2}:\d{2}\s+[AP]M$/.test(cleaned)) {
        cleaned = cleaned.replace(/(\d{1,2}:\d{2})\s+([AP]M)/, '$1:00 $2');
    }
    
    const parsed = parse(cleaned, 'h:mm:ss a', new Date());
    return isValidDate(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function isValidDate(d: any) {
  return d instanceof Date && !isNaN(d.getTime());
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

  console.log(`[Availability Sync] Starting sync for ${caregiversData.length} caregivers.`);

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
            continue;
        }

        const availabilityData: { [key: string]: any } = {
            caregiverId: caregiverRef.id,
            caregiverName: caregiver.name,
            lastUpdatedAt: now,
        };

        for (const day of DAY_COLUMNS) {
            let rawCellText = (caregiver.schedule[day] || '').trim();
            if (!rawCellText) {
                availabilityData[day.toLowerCase()] = { schedule: '', nonOvertimeHours: 0, totalShiftHours: 0, hasAvailabilityBlock: false };
                continue;
            }

            // --- Sanitization for robust parsing ---
            // 1. Remove carriage returns
            // 2. Standardize "To" vs "-"
            // 3. Ensure space before AM/PM
            let cellText = rawCellText.replace(/\r/g, "")
                .replace(/([0-9])([AP]M)/gi, '$1 $2') // Ensure space: "7:00:00AM" -> "7:00:00 AM"
                .replace(/\s*-\s*/g, ' - ') // Standardize hyphen spacing
                .replace(/\s*TO\s*/gi, ' To '); // Standardize "To" spacing

            let totalAvailabilityHours = 0;
            // Matches "Available [TIME] To [TIME]" or "Scheduled Availability [TIME] To [TIME]"
            const availabilityRegex = /(?:Scheduled\s+Availability|Available)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi;
            
            let availabilityMatch;
            while ((availabilityMatch = availabilityRegex.exec(cellText)) !== null) {
                const duration = calculateDurationInHours(availabilityMatch[1], availabilityMatch[2]);
                totalAvailabilityHours += duration;
                console.log(`[Availability Sync] FOUND AVAILABILITY: ${caregiver.name} on ${day}: ${availabilityMatch[1]} To ${availabilityMatch[2]} (${duration}h)`);
            }
            
            const hasAvailabilityBlock = totalAvailabilityHours > 0;
            const cappedAvailability = Math.min(totalAvailabilityHours, 9);

            let totalShiftHours = 0;
            // Matches "[TIME] - [TIME]" but NOT if prefixed by "Available" or "Scheduled"
            // We achieve this by looking for time ranges that DON'T follow the keywords,
            // or simply using the sanitized string and ensuring the hyphen matches are distinct.
            const shiftRegex = /(?<!Available\s|Availability\s)(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi;
            
            let shiftMatch;
            while ((shiftMatch = shiftRegex.exec(cellText)) !== null) {
                const duration = calculateDurationInHours(shiftMatch[1], shiftMatch[2]);
                totalShiftHours += duration;
                console.log(`[Availability Sync] FOUND SHIFT: ${caregiver.name} on ${day}: ${shiftMatch[1]} - ${shiftMatch[2]} (${duration}h)`);
            }
            
            const nonOvertimeHours = hasAvailabilityBlock ? (cappedAvailability - totalShiftHours) : (0 - totalShiftHours);
            
            availabilityData[day.toLowerCase()] = {
              schedule: cellText,
              nonOvertimeHours: parseFloat(nonOvertimeHours.toFixed(2)),
              totalShiftHours: parseFloat(totalShiftHours.toFixed(2)),
              hasAvailabilityBlock: hasAvailabilityBlock,
            };
            
            if (totalShiftHours > 0) {
                 console.log(`[Availability Sync] Summary ${caregiver.name} ${day}: Avail=${totalAvailabilityHours}h (capped ${cappedAvailability}h), Shifts=${totalShiftHours}h, Net=${nonOvertimeHours}h`);
            }
        }
        
        const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverRef.id).collection('availability').doc('current_week');
        batch.set(availabilityDocRef, availabilityData, { merge: true });
        operations++;
        caregiversUpdatedCount++;
    }
    
    if (operations > 0) {
        await batch.commit();
    }
    
    console.log(`[Availability Sync] COMPLETED. Updated ${caregiversUpdatedCount} caregivers.`);
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Updated ${caregiversUpdatedCount} availability records.` };

  } catch (error: any) {
      console.error('[Availability Sync Error] Critical failure:', error);
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
