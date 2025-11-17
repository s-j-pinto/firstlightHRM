
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
    return { message: message };

  } catch (error: any) {
    console.error('[Action Error] Critical error during upload process:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
