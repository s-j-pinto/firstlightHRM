
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import type { Client } from './types';

// Helper to create a unique key for each client row from the CSV
const createCompositeKey = (row: Record<string, any>): string => {
  const name = (row['Client Name'] || '').trim().toLowerCase();
  const mobile = (row['Mobile'] || '').trim().replace(/\D/g, '');
  if (!name || !mobile) {
    return '';
  }
  return `${name}-${mobile}`;
};

export async function processClientUpload(data: Record<string, any>[]) {
  const firestore = serverDb;
  const clientsCollection = firestore.collection('clients');
  const now = Timestamp.now();
  let batch: WriteBatch = firestore.batch();
  let operations = 0;

  try {
    // 1. Get all existing clients from Firestore
    const snapshot = await clientsCollection.get();
    const existingClients = new Map<string, { id: string; data: Client }>();
    snapshot.forEach(doc => {
      const docData = doc.data() as Client;
      const key = createCompositeKey(docData);
      if (key) {
        existingClients.set(key, { id: doc.id, data: docData });
      }
    });

    const incomingClientKeys = new Set<string>();

    // 2. Iterate through uploaded data to update or create clients
    for (const row of data) {
      const compositeKey = createCompositeKey(row);
      if (!compositeKey) continue; // Skip rows without required fields

      incomingClientKeys.add(compositeKey);
      const existingClient = existingClients.get(compositeKey);

      const clientData = {
        'Client Name': row['Client Name'] || '',
        'DOB': row['DOB'] || '',
        'Address': row['Address'] || '',
        'Apt/Unit': row['Apt/Unit'] || '',
        'City': row['City'] || '',
        'Zip': row['Zip'] || '',
        'Mobile': row['Mobile'] || '',
        'ContactName': row['ContactName'] || '',
        'ContactMobile': row['ContactMobile'] || '',
        status: 'ACTIVE',
        lastUpdatedAt: now,
      };

      if (existingClient) {
        // Update existing client
        const docRef = clientsCollection.doc(existingClient.id);
        batch.update(docRef, clientData);
      } else {
        // Create new client
        const docRef = clientsCollection.doc(); // Firestore auto-generates ID
        batch.set(docRef, { ...clientData, createdAt: now });
      }

      operations++;
      if (operations >= 499) { // Firestore batch limit is 500
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    }

    // 3. Mark clients not in the uploaded file as INACTIVE
    for (const [key, client] of existingClients.entries()) {
      if (!incomingClientKeys.has(key) && client.data.status === 'ACTIVE') {
        const docRef = clientsCollection.doc(client.id);
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

    revalidatePath('/admin/manage-clients');
    return { message: 'Client data processed successfully.' };
  } catch (error) {
    console.error('Error processing client upload:', error);
    return { message: `An error occurred: ${error}`, error: true };
  }
}
