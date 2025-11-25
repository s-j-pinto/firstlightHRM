
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';

export async function processActiveCaregiverUpload(data: Record<string, any>[]) {
  console.log(`[Action Start] processActiveCaregiverUpload received ${data.length} rows.`);
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();

  try {
    // 1. Fetch only ACTIVE caregivers to correctly determine who needs deactivation.
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

    // 2. Process the uploaded CSV data.
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
        // Update existing active caregiver
        const docRef = caregiversCollection.doc(existingCaregiver.id);
        batch.update(docRef, caregiverData);
        updatedCount++;
        // Remove from map so we know who is left to deactivate
        existingCaregiversMap.delete(email);
      } else {
        // This could be a new caregiver, or an inactive one being reactivated.
        // To handle both cases, we query by email.
        const query = caregiversCollection.where('Email', '==', email).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            // This is a completely new caregiver.
            const docRef = caregiversCollection.doc();
            batch.set(docRef, { ...caregiverData, createdAt: now });
            createdCount++;
        } else {
            // This caregiver exists but was inactive. Reactivate and update them.
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

    // 3. Any caregivers left in the map were active but not in the CSV. Deactivate them.
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

    // 4. Commit any remaining operations.
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

export async function processCaregiverAvailabilityUpload(data: Record<string, any>[]) {
  console.log(`[Action Start] processCaregiverAvailabilityUpload received ${data.length} rows.`);
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();
  const weekIdentifier = `week_${now.toDate().getFullYear()}_${now.toDate().getMonth() + 1}_${now.toDate().getDate()}`;

  const availabilityByCaregiverName: { [name: string]: { [day: string]: string[] } } = {};
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  for (const row of data) {
    const caregiverName = (row["Caregiver Name"] || '').trim();
    if (!caregiverName) {
      console.warn('Skipping row with no Caregiver Name:', row);
      continue;
    }

    const weeklyAvailability: { [day: string]: string[] } = {};
    for (const day of daysOfWeek) {
        const dayData = (row[day] || '').trim();
        if (dayData) {
            // Find all "Available" time slots in the cell.
            const availableSlots = dayData.split('\n')
                .map((s: string) => s.trim())
                .filter((s: string) => s.toLowerCase().startsWith('available'))
                .map((s: string) => {
                    // Clean up the string: "Available 4:00:00 PM To 7:00:00 PM" -> "4:00 PM-7:00 PM"
                    return s.replace(/available/i, '')
                            .replace(/(\d{1,2}:\d{2}):\d{2}/g, '$1') // Remove seconds
                            .replace(/ To /i, '-')
                            .trim();
                });
            
            if (availableSlots.length > 0) {
                 weeklyAvailability[day.toLowerCase()] = availableSlots;
            } else {
                 weeklyAvailability[day.toLowerCase()] = [];
            }
        } else {
            weeklyAvailability[day.toLowerCase()] = [];
        }
    }
    availabilityByCaregiverName[caregiverName] = weeklyAvailability;
  }
  
  const caregiverNames = Object.keys(availabilityByCaregiverName);
  if (caregiverNames.length === 0) {
    return { message: "No valid availability data found in the CSV.", error: true };
  }

  try {
    let batch = firestore.batch();
    let operations = 0;
    let updatedCount = 0;
    const notFoundNames: string[] = [];

    const querySnapshot = await caregiversCollection.where('Name', 'in', caregiverNames).get();
    
    const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();
    querySnapshot.forEach(doc => {
      const docData = doc.data();
      const name = (docData.Name || '').trim();
      if (name) {
        profileMap.set(name, doc.ref);
      }
    });

    for (const name of caregiverNames) {
      const caregiverRef = profileMap.get(name);
      if (caregiverRef) {
        // Create a reference to the new document in the subcollection.
        const availabilityDocRef = caregiverRef.collection('availability').doc(weekIdentifier);
        
        const availabilityData = availabilityByCaregiverName[name];
        
        // Add the set operation for the new availability document to the batch.
        batch.set(availabilityDocRef, { ...availabilityData, createdAt: now });
        
        // Also update the main caregiver document's timestamp.
        batch.update(caregiverRef, { lastUpdatedAt: now });

        updatedCount++;
        operations += 2; // We are doing two operations per caregiver now.

        if (operations >= 498) { // Keep well under the 500 limit
          await batch.commit();
          batch = firestore.batch();
          operations = 0;
        }
      } else {
        notFoundNames.push(name);
      }
    }

    if (operations > 0) {
      await batch.commit();
    }

    let message = `Availability updated for ${updatedCount} caregivers.`;
    if (notFoundNames.length > 0) {
      message += ` Could not find active profiles for ${notFoundNames.length} names: ${notFoundNames.slice(0, 5).join(', ')}...`;
      console.warn('Not found names:', notFoundNames);
    }

    revalidatePath('/staffing-admin/manage-active-caregivers');
    return { message };

  } catch (error: any) {
    console.error('[Action Error] Critical error during availability upload:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
