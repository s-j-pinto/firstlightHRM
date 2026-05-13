
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
    let cleaned = timeStr.trim().toUpperCase();
    
    // Ensure seconds are present for the parser if missing (e.g., "7:00 AM" -> "7:00:00 AM")
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
    // Handle overnight shifts
    if (diff < 0) {
      diff += 24 * 60;
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
        }
      }
    });

    let batch = firestore.batch();
    let operations = 0;
    let caregiversUpdatedCount = 0;

    for (const caregiver of caregiversData) {
        const caregiverRef = profileMap.get(caregiver.name.trim());
        if (!caregiverRef) continue;

        const availabilityData: { [key: string]: any } = {
            caregiverId: caregiverRef.id,
            caregiverName: caregiver.name,
            lastUpdatedAt: now,
        };

        for (const day of DAY_COLUMNS) {
            const rawCellText = (caregiver.schedule[day] || '').trim();
            if (!rawCellText) {
                availabilityData[day.toLowerCase()] = { schedule: '', nonOvertimeHours: 0, totalShiftHours: 0, hasAvailabilityBlock: false };
                continue;
            }

            // --- Aggressive Sanitization & Stretching ---
            // Handles cases like "Availability6:00:00 AM", "PMAvailable", etc.
            let cellText = rawCellText.replace(/\r/g, "")
                .replace(/([0-9])([AP]M)/gi, '$1 $2') // Digit before AM/PM
                .replace(/([AP]M)([A-Z])/gi, '$1 $2') // AM/PM before word (e.g., PMAvailable)
                .replace(/Scheduled\s*Availability/gi, ' Scheduled Availability ')
                .replace(/Available/gi, ' Available ')
                .replace(/To/gi, ' To ')
                .replace(/\s*-\s*/g, ' - ')
                .replace(/\s+/g, ' '); // Collapse extra whitespace

            console.log(`[Availability Sync] Parsing: ${caregiver.name} | ${day} | Formatted: ${cellText}`);

            // Regex for Availability (must use "To")
            const availabilityRegex = /(?:Scheduled\s+Availability|Available)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi;
            
            // Regex for Shifts (must use a hyphen "-")
            const shiftRegex = /(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi;

            let totalAvailabilityHours = 0;
            let m;
            while ((m = availabilityRegex.exec(cellText)) !== null) {
                const duration = calculateDurationInHours(m[1], m[2]);
                totalAvailabilityHours += duration;
                console.log(`[Availability Sync] FOUND AVAILABILITY: ${m[1]} To ${m[2]} (${duration.toFixed(2)}h)`);
            }
            
            const hasAvailabilityBlock = totalAvailabilityHours > 0;
            const cappedAvailability = Math.min(totalAvailabilityHours, 9);

            let totalShiftHours = 0;
            while ((m = shiftRegex.exec(cellText)) !== null) {
                const duration = calculateDurationInHours(m[1], m[2]);
                totalShiftHours += duration;
                console.log(`[Availability Sync] FOUND SHIFT: ${m[1]} - ${m[2]} (${duration.toFixed(2)}h)`);
            }
            
            const nonOvertimeHours = hasAvailabilityBlock ? (cappedAvailability - totalShiftHours) : (0 - totalShiftHours);
            
            availabilityData[day.toLowerCase()] = {
              schedule: cellText,
              nonOvertimeHours: parseFloat(nonOvertimeHours.toFixed(2)),
              totalShiftHours: parseFloat(totalShiftHours.toFixed(2)),
              hasAvailabilityBlock: hasAvailabilityBlock,
            };
        }
        
        const availabilityDocRef = firestore.collection('caregivers_active').doc(caregiverRef.id).collection('availability').doc('current_week');
        batch.set(availabilityDocRef, availabilityData, { merge: true });
        operations++;
        caregiversUpdatedCount++;

        if (operations >= 400) {
            await batch.commit();
            batch = firestore.batch();
            operations = 0;
        }
    }
    
    if (operations > 0) {
        await batch.commit();
    }
    
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload finished. Updated ${caregiversUpdatedCount} availability records.` };

  } catch (error: any) {
      console.error('[Availability Sync Error]:', error);
      return { message: `An error occurred: ${error.message}`, error: true };
  }
}

function createCaregiverCompositeKey(name: string, mobile: string, address: string): string {
    const normalizedName = (name || '').trim().toLowerCase();
    const normalizedMobile = (mobile || '').replace(/\D/g, '');
    const normalizedAddress = (address || '').trim().toLowerCase();
    return `${normalizedName}|${normalizedMobile}|${normalizedAddress}`;
}

export async function processActiveCaregiverProfiles(data: Record<string, any>[]) {
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();

  try {
    const existingCaregiversSnap = await caregiversCollection.get();
    const existingCaregiversMap = new Map<string, { id: string, data: any }>();
    
    existingCaregiversSnap.forEach(doc => {
      const docData = doc.data();
      const key = createCaregiverCompositeKey(docData['Name'], docData['Mobile'], docData['Address']);
      if (key !== '||') {
        existingCaregiversMap.set(key, { id: doc.id, data: docData });
      }
    });

    let batch: WriteBatch = firestore.batch();
    let operations = 0;
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const row of data) {
      const caregiverName = row['Name'];
      const mobile = row['Mobile'];
      const address = row['Address'];
      const compositeKey = createCaregiverCompositeKey(caregiverName, mobile, address);

      if (compositeKey === '||') continue;
      
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
        const docRef = caregiversCollection.doc(existingCaregiver.id);
        batch.update(docRef, caregiverData);
        updatedCount++;
        existingCaregiversMap.delete(compositeKey);
      } else {
        const docRef = caregiversCollection.doc();
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

    for (const [key, { id }] of existingCaregiversMap.entries()) {
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

    if (operations > 0) {
      await batch.commit();
    }

    revalidatePath('/admin/manage-active-caregivers');
    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message: `Upload complete. Created: ${createdCount}, Updated: ${updatedCount}, Deactivated: ${deactivatedCount}.` };

  } catch (error: any) {
    console.error('[Action Error]:', error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}


export async function processActiveCaregiverPreferencesUpload(data: Record<string, any>[]) {
    const firestore = serverDb;
    const now = Timestamp.now();

    if (!data || data.length === 0) {
        return { message: "No preference data was processed.", error: true };
    }

    try {
        const allCaregiversSnap = await firestore.collection('caregivers_active').where('status', '==', 'Active').get();
        const profileMap = new Map<string, string>();

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
            if (!caregiverId) continue;

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
        console.error('[Action Error]:', error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}
