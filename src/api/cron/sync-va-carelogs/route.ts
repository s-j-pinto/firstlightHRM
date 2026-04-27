'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { parse as parseDate, isValid } from 'date-fns';

// Helper to parse the inconsistent client name string
function parseClientName(fullName: string): string {
    if (!fullName) return "Unknown Client";
    // Find the first parenthesis that is likely part of a phone number, which is preceded by a space.
    const separatorIndex = fullName.search(/\s+\(\d/);
    if (separatorIndex > 0) {
        // Return the substring before this pattern
        return fullName.substring(0, separatorIndex).trim();
    }
    // Fallback for cases where the pattern isn't found, e.g., no phone number
    const fallbackIndex = fullName.indexOf('(');
    if (fallbackIndex > 0) {
       return fullName.substring(0, fallbackIndex).replace(/,\s*$/, '').trim();
    }
    return fullName.trim();
}

// Helper to parse date strings like "Mon 4/20/2026"
function parseTeletrackDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') {
        console.warn(`[SYNC-VA-CARELOGS] Invalid date input provided: ${dateStr}`);
        return null;
    }
    // Use a regex to find the date pattern, making it robust against spacing issues.
    const dateMatch = dateStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
    if (!dateMatch) {
        console.warn(`[SYNC-VA-CARELOGS] Could not find a date pattern in "${dateStr}".`);
        return null;
    }

    const cleanDateStr = dateMatch[0];
    const parsed = parseDate(cleanDateStr, 'M/d/yyyy', new Date());

    if (isValid(parsed)) {
        return parsed;
    }
    
    console.warn(`[SYNC-VA-CARELOGS] Could not parse a valid date from "${dateStr}".`);
    return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Delete all existing documents in the va_teletrack_shifts collection
    console.log('Clearing existing VA Teletrack shifts...');
    const shiftsCollectionRef = serverDb.collection('va_teletrack_shifts');
    const querySnapshot = await shiftsCollectionRef.get();
    let deletedCount = 0;
    
    if (!querySnapshot.empty) {
        const batchArray: FirebaseFirestore.WriteBatch[] = [];
        batchArray.push(serverDb.batch());
        let operationCounter = 0;
        let batchIndex = 0;

        querySnapshot.docs.forEach(doc => {
            batchArray[batchIndex].delete(doc.ref);
            operationCounter++;

            if (operationCounter === 499) {
                batchArray.push(serverDb.batch());
                batchIndex++;
                operationCounter = 0;
            }
        });
        
        await Promise.all(batchArray.map(batch => batch.commit()));
        deletedCount = querySnapshot.size;
        console.log(`Cleared ${deletedCount} existing shifts.`);
    }

    // 2. Load and insert new data from JSON file
    const bucket = getStorage(serverApp).bucket(process.env.GCLOUD_STORAGE_BUCKET || 'gs://firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('CareLogs/VA_CareLogs/TeleTrack-VA-CareLogs.json');
    const [contents] = await file.download();
    const jsonData = JSON.parse(contents.toString());
    
    if (!jsonData || !Array.isArray(jsonData.clients)) {
        console.error("Parsed JSON does not contain a 'clients' array.");
        return NextResponse.json({ success: false, error: "Invalid JSON structure in source file." }, { status: 500 });
    }
    const clients = jsonData.clients;

    const caregiversSnap = await serverDb.collection('caregivers_active').get();
    const caregiverNameToIdMap = new Map<string, string>();
    caregiversSnap.forEach(doc => {
      const caregiver = doc.data();
      const name = caregiver.Name;
      if (name) {
        const trimmedName = name.trim().toLowerCase();
        // Handle "Last, First" format
        const parts = trimmedName.split(',').map((p: string) => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          const normalizedName = `${parts[1]} ${parts[0]}`;
          caregiverNameToIdMap.set(normalizedName, doc.id);
        }
        // Also map the original name in case it's in "First Last" format
        caregiverNameToIdMap.set(trimmedName, doc.id);
      }
    });

    let insertBatch = serverDb.batch();
    let operations = 0;
    let shiftsAdded = 0;

    for (const client of clients) {
      if (!client.schedules || client.schedules.length === 0) {
        continue;
      }
      
      const parsedClientName = parseClientName(client.clientName);

      for (const schedule of client.schedules) {
        const scheduleDate = parseTeletrackDate(schedule.date);
        if (!scheduleDate) {
            console.warn(`Skipping schedule for client ${client.clientId} due to invalid date: ${schedule.date}`);
            continue;
        }

        const jsonCaregiverName = `${schedule.caregiver.firstName} ${schedule.caregiver.lastName}`;
        const caregiverId = caregiverNameToIdMap.get(jsonCaregiverName.toLowerCase()) || null;

        if (!caregiverId) {
            console.warn(`[SYNC-VA-CARELOGS] Could not find matching caregiver ID for: "${jsonCaregiverName}"`);
        }

        const shiftDoc = {
          clientId: client.clientId,
          clientName: parsedClientName,
          caregiverId: caregiverId,
          date: Timestamp.fromDate(scheduleDate),
          day: schedule.day,
          caregiverName: jsonCaregiverName,
          ratePlan: schedule.ratePlan,
          arrivalTime: schedule.arrivalTime,
          departureTime: schedule.departureTime,
          createdAt: Timestamp.now(),
        };

        const docRef = serverDb.collection('va_teletrack_shifts').doc(); // Auto-generate ID
        insertBatch.set(docRef, shiftDoc);
        operations++;
        shiftsAdded++;
        
        if (operations >= 499) {
            await insertBatch.commit();
            operations = 0;
            insertBatch = serverDb.batch(); // Re-initialize the batch
        }
      }
    }

    if (operations > 0) {
      await insertBatch.commit();
      console.log("Committed final batch of VA shift records.");
    }

    return NextResponse.json({ success: true, message: `Successfully cleared ${deletedCount} records and synced ${shiftsAdded} new VA Teletrack shifts.` });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-va-carelogs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
