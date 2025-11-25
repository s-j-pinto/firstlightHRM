
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { WriteBatch, Timestamp } from 'firebase-admin/firestore';
import type { Client } from './types';

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

export async function processCaregiverAvailabilityUpload(csvText: string) {
  console.log(`[Action Start] processCaregiverAvailabilityUpload received CSV text.`);
  const firestore = serverDb;
  const now = Timestamp.now();
  const weekIdentifier = `week_${now.toDate().getFullYear()}_${now.toDate().getMonth() + 1}_${now.toDate().getDate()}`;
  
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 3) { // Must have header, and at least one pair of name/availability rows
      return { message: "CSV is too short. Expected a header row and at least one pair of caregiver/availability rows.", error: true };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  
  const dayIndices: { [day: string]: number } = {};
  daysOfWeek.forEach(day => {
      const index = headers.indexOf(day);
      if (index !== -1) {
          dayIndices[day] = index;
      }
  });

  const caregiverNamesToProcess: string[] = [];
  const availabilityByCaregiverName: { [name: string]: { [day: string]: string[] } } = {};

  // Process rows in pairs (caregiver name, then availability)
  for (let i = 1; i < lines.length; i += 2) {
    const nameLine = lines[i];
    const availabilityLine = lines[i + 1];

    if (!nameLine || !availabilityLine) {
        console.warn(`Skipping incomplete pair at line ${i+1}`);
        continue;
    }
    
    const caregiverName = (nameLine.split(',')[0] || '').trim();
    if (!caregiverName) {
        console.warn(`Skipping pair with no caregiver name at line ${i+1}`);
        continue;
    }

    caregiverNamesToProcess.push(caregiverName);
    const availabilityRow = availabilityLine.split(',');
    const weeklyAvailability: { [day: string]: string[] } = {};

    for (const day in dayIndices) {
        const columnIndex = dayIndices[day];
        const cellData = (availabilityRow[columnIndex] || '').trim();
        
        if (cellData && cellData.toLowerCase().includes('available')) {
            const timeSlots = cellData.split('\n')
                .map(s => s.trim())
                .filter(s => s.toLowerCase().startsWith('available'))
                .map(s => {
                    return s.replace(/available/i, '')
                            .replace(/(\d{1,2}:\d{2}):\d{2}/g, '$1') // Remove seconds
                            .replace(/ To /ig, '-')
                            .replace(/\s+-\s+/g, '-')
                            .trim();
                });
            if (timeSlots.length > 0) {
                 weeklyAvailability[day] = timeSlots;
            }
        }
    }
    
    if (Object.keys(weeklyAvailability).length > 0) {
        availabilityByCaregiverName[caregiverName] = weeklyAvailability;
    }
  }

  if (caregiverNamesToProcess.length === 0) {
    return { message: "No valid caregiver availability data found in the CSV.", error: true };
  }

  try {
    let batch = firestore.batch();
    let operations = 0;
    let updatedCount = 0;
    const notFoundNames: string[] = [];

    const profileMap = new Map<string, FirebaseFirestore.DocumentReference>();

    // Chunk the names array to handle Firestore's 'in' query limit of 30.
    const CHUNK_SIZE = 30;
    for (let i = 0; i < caregiverNamesToProcess.length; i += CHUNK_SIZE) {
        const chunk = caregiverNamesToProcess.slice(i, i + CHUNK_SIZE);
        const querySnapshot = await firestore.collection('caregivers_active').where('Name', 'in', chunk).get();
        
        querySnapshot.forEach(doc => {
            const docData = doc.data();
            const name = (docData.Name || '').trim();
            if (name) {
                profileMap.set(name, doc.ref);
            }
        });
    }

    for (const name of caregiverNamesToProcess) {
      const caregiverRef = profileMap.get(name);
      if (caregiverRef && availabilityByCaregiverName[name]) {
        const availabilityDocRef = caregiverRef.collection('availability').doc(weekIdentifier);
        const availabilityData = availabilityByCaregiverName[name];
        
        batch.set(availabilityDocRef, { ...availabilityData, createdAt: now });
        batch.update(caregiverRef, { lastUpdatedAt: now });

        updatedCount++;
        operations += 2; 

        if (operations >= 498) {
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

    