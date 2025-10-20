
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
    
    // Get all existing caregivers. If the collection doesn't exist, the snapshot will be empty.
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


    const incomingCaregiverKeys = new Set<string>();

    for (const row of data) {
      const emailKey = getEmailKey(row);
      if (!emailKey) {
        console.warn('[Action] Skipping row due to missing email:', row);
        continue;
      }
      incomingCaregiverKeys.add(emailKey);

      const existingCaregiver = existingCaregivers.get(emailKey);
      
      const caregiverData = {
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

      const docRef = existingCaregiver
        ? caregiversCollection.doc(existingCaregiver.id)
        : caregiversCollection.doc();
      
      if (existingCaregiver) {
        batch.set(docRef, caregiverData, { merge: true });
      } else {
        batch.set(docRef, { ...caregiverData, createdAt: now }, { merge: true });
      }
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
