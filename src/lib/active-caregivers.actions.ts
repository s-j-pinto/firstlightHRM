
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import type { ActiveCaregiver } from './types';

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
    const existingCaregivers = new Map<string, { id: string; data: ActiveCaregiver }>();
    
    // Attempt to get the snapshot, but catch the NOT_FOUND error if the collection doesn't exist.
    try {
        const snapshot = await caregiversCollection.get();
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const docData = doc.data() as ActiveCaregiver;
                const key = getEmailKey(docData);
                if (key) {
                    existingCaregivers.set(key, { id: doc.id, data: docData });
                }
            });
        }
        console.log(`[Action] Found ${existingCaregivers.size} existing caregivers.`);
    } catch (error: any) {
        // If the collection doesn't exist (code 5), we can safely ignore the error and proceed.
        // The `existingCaregivers` map will simply be empty.
        if (error.code === 5) { // 5 is the gRPC code for NOT_FOUND
            console.log("[Action] 'caregivers_active' collection does not exist yet. Proceeding with new upload.");
        } else {
            // For any other error, we should re-throw it to be caught by the outer catch block.
            throw error;
        }
    }


    const incomingCaregiverKeys = new Set<string>();

    for (const row of data) {
      const emailKey = getEmailKey(row);
      if (!emailKey) {
        console.warn('[Action] Skipping row due to missing email:', row);
        continue;
      }
      incomingCaregiverKeys.add(emailKey);

      const existingCaregiver = existingCaregivers.get(emailKey);

      const caregiverData: Omit<ActiveCaregiver, 'id'> = {
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
        createdAt: existingCaregiver ? existingCaregiver.data.createdAt : now,
        lastUpdatedAt: now,
      };

      const docRef = existingCaregiver
        ? caregiversCollection.doc(existingCaregiver.id)
        : caregiversCollection.doc();
      
      batch.set(docRef, caregiverData, { merge: true });
      operations++;

      if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

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

    if (operations > 0) {
      await batch.commit();
    }

    revalidatePath('/admin/manage-active-caregivers');
    return { message: `Processed ${data.length} rows. Active caregiver data has been updated.` };
  } catch (error: any) {
    console.error('[Action Error] Error processing active caregiver upload:', error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}
