
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import type { ActiveCaregiver } from './types';

// Helper to create a unique key for each caregiver row from the CSV
const getEmailKey = (row: Record<string, any>): string | null => {
  const email = (row['Email'] || '').trim().toLowerCase();
  return email || null;
};

export async function processActiveCaregiverUpload(data: Record<string, any>[]) {
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();
  let batch: WriteBatch = firestore.batch();
  let operations = 0;

  try {
    // 1. Get all existing active caregivers from Firestore
    const snapshot = await caregiversCollection.get();
    const existingCaregivers = new Map<string, { id: string; data: ActiveCaregiver }>();
    snapshot.forEach(doc => {
      const docData = doc.data() as ActiveCaregiver;
      const key = getEmailKey(docData);
      if (key) {
        existingCaregivers.set(key, { id: doc.id, data: docData });
      }
    });

    const incomingCaregiverKeys = new Set<string>();

    // 2. Iterate through uploaded data to update or create caregivers
    for (const row of data) {
      const emailKey = getEmailKey(row);
      if (!emailKey) continue; // Skip rows without an email

      incomingCaregiverKeys.add(emailKey);
      const existingCaregiver = existingCaregivers.get(emailKey);

      const caregiverData: Omit<ActiveCaregiver, 'id' | 'createdAt'> = {
        'Name': row['Name'] || '',
        'D.O.B.': row['D.O.B.'] || '',
        'Address': row['Address'] || '',
        'Apt': row['Apt'] || '',
        'City': row['City'] || '',
        'State': row['State'] || '',
        'Zip': row['Zip'] || '',
        'Mobile': row['Mobile'] || '',
        'Hire Date': row['Hire Date'] || '',
        'Email': row['Email'] || '',
        'Drivers Lic': row['Drivers Lic'] || '',
        'Caregiver Lic': row['Caregiver Lic'] || '',
        'PIN': row['PIN'] || '',
        status: 'ACTIVE',
        lastUpdatedAt: now,
      };

      if (existingCaregiver) {
        // Update existing caregiver
        const docRef = caregiversCollection.doc(existingCaregiver.id);
        batch.update(docRef, caregiverData);
      } else {
        // Create new caregiver
        const docRef = caregiversCollection.doc(); // Firestore auto-generates ID
        batch.set(docRef, { ...caregiverData, createdAt: now });
      }

      operations++;
      if (operations >= 499) { // Firestore batch limit is 500
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

    // 3. Mark caregivers not in the uploaded file as INACTIVE
    for (const [key, caregiver] of existingCaregivers.entries()) {
      if (!incomingCaregiverKeys.has(key) && caregiver.data.status === 'ACTIVE') {
        const docRef = caregiversCollection.doc(caregiver.id);
        batch.update(docRef, { status: 'INACTIVE', lastUpdatedAt: now });
        operations++;
        if (operations >= 499) {
          await batch.commit();
          batch = firestore.batch();
          operations = 0;
        }
      }
    }

    // 4. Commit any remaining operations
    if (operations > 0) {
      await batch.commit();
    }

    revalidatePath('/admin/manage-active-caregivers');
    return { message: 'Active caregiver data processed successfully.' };
  } catch (error) {
    console.error('Error processing active caregiver upload:', error);
    return { message: `An error occurred: ${error}`, error: true };
  }
}
