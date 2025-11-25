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

export async function processCaregiverAvailabilityUpload(data: { email: string; day_of_week: string; shift: string }[]) {
  console.log(`[Action Start] processCaregiverAvailabilityUpload received ${data.length} rows.`);
  const firestore = serverDb;
  const profilesCollection = firestore.collection('caregiver_profiles');

  const availabilityByEmail: { [email: string]: { [day: string]: string[] } } = {};
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const validShifts = ['morning', 'afternoon', 'evening', 'night'];

  // 1. Aggregate availability data from the CSV
  for (const row of data) {
    const email = (row.email || '').trim().toLowerCase();
    const day = (row.day_of_week || '').trim().toLowerCase();
    const shift = (row.shift || '').trim().toLowerCase();

    if (!email || !validDays.includes(day) || !validShifts.includes(shift)) {
      console.warn('Skipping invalid row:', row);
      continue;
    }

    if (!availabilityByEmail[email]) {
      availabilityByEmail[email] = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
    }

    if (!availabilityByEmail[email][day].includes(shift)) {
      availabilityByEmail[email][day].push(shift);
    }
  }

  const emails = Object.keys(availabilityByEmail);
  if (emails.length === 0) {
    return { message: "No valid availability data found in the CSV.", error: true };
  }

  try {
    let batch = firestore.batch();
    let operations = 0;
    let updatedCount = 0;
    const notFoundEmails: string[] = [];

    // 2. Fetch all matching caregiver profiles in one go
    const querySnapshot = await profilesCollection.where('email', 'in', emails).get();
    
    const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();
    querySnapshot.forEach(doc => {
      const docData = doc.data();
      const email = (docData.email || '').trim().toLowerCase();
      if(email) {
        profileMap.set(email, doc.ref);
      }
    });

    // 3. Update profiles in a batch
    for (const email of emails) {
      const docRef = profileMap.get(email);
      if (docRef) {
        batch.update(docRef, { availability: availabilityByEmail[email] });
        updatedCount++;
        operations++;

        if (operations >= 499) {
          await batch.commit();
          batch = firestore.batch();
          operations = 0;
        }
      } else {
        notFoundEmails.push(email);
      }
    }

    if (operations > 0) {
      await batch.commit();
    }

    let message = `Availability updated for ${updatedCount} caregivers.`;
    if (notFoundEmails.length > 0) {
      message += ` Could not find profiles for ${notFoundEmails.length} emails: ${notFoundEmails.slice(0, 5).join(', ')}...`;
      console.warn('Not found emails:', notFoundEmails);
    }

    revalidatePath('/admin/advanced-search');
    return { message };

  } catch (error: any) {
    console.error('[Action Error] Critical error during availability upload:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
