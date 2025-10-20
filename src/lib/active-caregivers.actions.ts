
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import type { ActiveCaregiver } from './types';

// Helper to create a unique key for each caregiver row.
// It now checks for both 'Email' (from CSV) and 'email' (from Firestore).
const getEmailKey = (row: Record<string, any>): string | null => {
  const email = (row['Email'] || row['email'] || '').trim().toLowerCase();
  return email || null;
};

export async function processActiveCaregiverUpload(data: Record<string, any>[]) {
  console.log(`[Action Start] processActiveCaregiverUpload received ${data.length} rows.`);
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();
  let batch: WriteBatch = firestore.batch();
  let operations = 0;

  try {
    // 1. Get all existing active caregivers from Firestore
    console.log('[Action] Fetching existing caregivers from Firestore...');
    const snapshot = await caregiversCollection.get();
    const existingCaregivers = new Map<string, { id: string; data: ActiveCaregiver }>();
    snapshot.forEach(doc => {
      const docData = doc.data() as ActiveCaregiver;
      const key = getEmailKey(docData);
      if (key) {
        existingCaregivers.set(key, { id: doc.id, data: docData });
      }
    });
    console.log(`[Action] Found ${existingCaregivers.size} existing caregivers.`);

    const incomingCaregiverKeys = new Set<string>();

    // 2. Iterate through uploaded data to update or create caregivers
    console.log('[Action] Processing uploaded CSV data...');
    for (const row of data) {
      const emailKey = getEmailKey(row);
      if (!emailKey) {
        console.warn('[Action] Skipping row due to missing email:', row);
        continue;
      }
      console.log(`[Action] Processing row for email: ${emailKey}`);

      incomingCaregiverKeys.add(emailKey);
      const existingCaregiver = existingCaregivers.get(emailKey);

      const caregiverData: Omit<ActiveCaregiver, 'id' | 'createdAt' | 'lastUpdatedAt'> & { lastUpdatedAt: Timestamp } = {
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
        console.log(`[Action] Updating existing caregiver: ${emailKey}`);
        const docRef = caregiversCollection.doc(existingCaregiver.id);
        batch.update(docRef, caregiverData);
      } else {
        // Create new caregiver
        console.log(`[Action] Creating new caregiver: ${emailKey}`);
        const docRef = caregiversCollection.doc(); // Firestore auto-generates ID
        batch.set(docRef, { ...caregiverData, createdAt: now });
      }

      operations++;
      if (operations >= 499) { // Firestore batch limit is 500
        console.log(`[Action] Committing batch of ${operations} operations...`);
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
        console.log('[Action] Batch committed. New batch created.');
      }
    }

    // 3. Mark caregivers not in the uploaded file as INACTIVE
    console.log('[Action] Checking for caregivers to mark as INACTIVE...');
    for (const [key, caregiver] of existingCaregivers.entries()) {
      if (!incomingCaregiverKeys.has(key) && caregiver.data.status === 'ACTIVE') {
        console.log(`[Action] Marking caregiver as INACTIVE: ${key}`);
        const docRef = caregiversCollection.doc(caregiver.id);
        batch.update(docRef, { status: 'INACTIVE', lastUpdatedAt: now });
        operations++;
        if (operations >= 499) {
          console.log(`[Action] Committing batch of ${operations} operations (inactivation)...`);
          await batch.commit();
          batch = firestore.batch();
          operations = 0;
          console.log('[Action] Batch committed. New batch created.');
        }
      }
    }

    // 4. Commit any remaining operations
    if (operations > 0) {
      console.log(`[Action] Committing final batch of ${operations} operations...`);
      await batch.commit();
      console.log('[Action] Final batch committed.');
    }

    console.log('[Action] Revalidating path /admin/manage-active-caregivers');
    revalidatePath('/admin/manage-active-caregivers');
    
    console.log('[Action Success] Active caregiver data processed successfully.');
    return { message: 'Active caregiver data processed successfully.' };
  } catch (error) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('[Action Error] Error processing active caregiver upload:', error);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    
    // Ensure a generic but helpful message is returned on failure.
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { message: `An error occurred: ${errorMessage}`, error: true };
  }
}
