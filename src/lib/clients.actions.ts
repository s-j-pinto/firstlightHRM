
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import type { Client } from './types';

function createCompositeKey(name: string, mobile: string, address: string, city: string): string {
    const normalizedName = (name || '').trim().toLowerCase();
    const normalizedMobile = (mobile || '').replace(/\D/g, ''); // Remove non-digits
    const normalizedAddress = (address || '').trim().toLowerCase();
    const normalizedCity = (city || '').trim().toLowerCase();
    return `${normalizedName}|${normalizedMobile}|${normalizedAddress}|${normalizedCity}`;
}

export async function processClientUpload(data: Record<string, any>[]) {
  console.log(`[Action Start] processClientUpload received ${data.length} rows.`);
  const firestore = serverDb;
  const clientsCollection = firestore.collection('Clients');
  const now = Timestamp.now();

  try {
    const existingClientsSnap = await clientsCollection.where('status', '==', 'ACTIVE').get();
    const existingClientsMap = new Map<string, { id: string, data: any }>();
    
    existingClientsSnap.forEach(doc => {
      const docData = doc.data();
      const key = createCompositeKey(docData['Client Name'], docData['Mobile'], docData['Address'], docData['City']);
      if (key !== '|||') { // Ensure we have a valid key
        existingClientsMap.set(key, { id: doc.id, data: docData });
      }
    });
    console.log(`[Action] Found ${existingClientsMap.size} existing active clients.`);

    let batch: WriteBatch = firestore.batch();
    let operations = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of data) {
      const clientName = row['Client Name'];
      const mobile = row['Mobile'];
      const address = row['Address'];
      const city = row['City'];
      const compositeKey = createCompositeKey(clientName, mobile, address, city);

      if (compositeKey === '|||') {
        console.warn('[Action] Skipping row due to missing "Client Name", "Mobile", "Address", or "City":', row);
        continue;
      }
      
      const clientData = {
        'Client Name': clientName,
        'DOB': row['DOB'] || '',
        'Address': address || '',
        'aptUnit': row['Apt/Unit'] || '',
        'City': city || '',
        'Zip': row['Zip'] || '',
        'Mobile': mobile,
        'ContactName': row['ContactName'] || '',
        'ContactMobile': row['ContactMobile'] || '',
        status: 'ACTIVE',
        lastUpdatedAt: now,
      };

      const existingClient = existingClientsMap.get(compositeKey);

      if (existingClient) {
        const docRef = clientsCollection.doc(existingClient.id);
        batch.update(docRef, clientData);
        updatedCount++;
        existingClientsMap.delete(compositeKey);
      } else {
        const docRef = clientsCollection.doc();
        batch.set(docRef, { ...clientData, createdAt: now });
        createdCount++;
      }

      operations++;
      if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

    // Deactivate clients not in the current upload
    for (const [key, { id }] of existingClientsMap.entries()) {
      console.log(`[Action] Deactivating client not in CSV: ${key}`);
      const docRef = clientsCollection.doc(id);
      batch.update(docRef, { status: 'INACTIVE', lastUpdatedAt: now });
      operations++;
       if (operations >= 499) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }
    const deactivatedCount = existingClientsMap.size;

    if (operations > 0) {
      await batch.commit();
    }

    const message = `Upload complete. Created: ${createdCount}, Updated: ${updatedCount}, Deactivated: ${deactivatedCount}.`;
    console.log(`[Action Success] ${message}`);
    revalidatePath('/admin/manage-clients');
    revalidatePath('/staffing-admin/manage-clients');
    return { message };

  } catch (error: any) {
    console.error('[Action Error] Critical error during client upload process:', error);
    return { message: `An error occurred during the upload: ${error.message}`, error: true };
  }
}
