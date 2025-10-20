
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';

export async function processActiveCaregiverUpload(data: Record<string, any>[]) {
  console.log(`[Action Start] processActiveCaregiverUpload (simple insert) received ${data.length} rows.`);
  const firestore = serverDb;
  const caregiversCollection = firestore.collection('caregivers_active');
  const now = Timestamp.now();
  let batch: WriteBatch = firestore.batch();
  let operations = 0;
  let successfulInserts = 0;

  try {
    for (const row of data) {
      // Basic validation for an email to use as an identifier, though we aren't checking for duplicates.
      const email = (row['Email'] || row['email'] || '').trim().toLowerCase();
      if (!email) {
        console.warn('[Action] Skipping row due to missing email:', row);
        continue;
      }

      // Prepare the data for the new document.
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
        'Email': email,
        'Drivers Lic': row['Drivers Lic'] || '',
        'Caregiver Lic': row['Caregiver Lic'] || '',
        'PIN': row['PIN'] || '',
        status: 'ACTIVE',
        lastUpdatedAt: now,
        createdAt: now,
      };

      // Create a new document reference for each row.
      const docRef = caregiversCollection.doc();
      batch.set(docRef, caregiverData);
      operations++;
      successfulInserts++;

      // Commit the batch every 499 operations to stay under Firestore limits.
      if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

    // Commit any remaining operations in the last batch.
    if (operations > 0) {
      await batch.commit();
    }

    console.log(`[Action Success] Successfully inserted ${successfulInserts} documents.`);
    revalidatePath('/admin/manage-active-caregivers');
    return { message: `Upload successful. ${successfulInserts} new caregiver records were created.` };

  } catch (error: any) {
    console.error('[Action Error] Critical error during simple insert:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
