
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { isValid, subWeeks, getDay, addDays, set as setDate } from 'date-fns';
import { toDate as toDateTz, formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// Helper to parse the inconsistent client name string
function parseClientName(fullName: string): string {
    if (!fullName) return "Unknown Client";
    const separatorIndex = fullName.search(/\s+\(\d/);
    if (separatorIndex > 0) {
        return fullName.substring(0, separatorIndex).trim();
    }
    const fallbackIndex = fullName.indexOf('(');
    if (fallbackIndex > 0) {
       return fullName.substring(0, fallbackIndex).replace(/,\s*$/, '').trim();
    }
    return fullName.trim();
}

// This function now correctly interprets the date string as a date in the Pacific timezone.
function parseTeletrackDate(dateStr: string, timeZone: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') {
        console.warn(`[SYNC-VA-CARELOGS] Invalid date input provided: ${dateStr}`);
        return null;
    }
    // Updated regex to be more robust for M/d/yyyy format
    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) {
        console.warn(`[SYNC-VA-CARELOGS] Could not find a date pattern in "${dateStr}".`);
        return null;
    }

    const [, month, day, year] = dateMatch;
    // Manually construct YYYY-MM-DD string to avoid locale parsing issues
    const isoLikeString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
    
    // fromZonedTime interprets the string as being in the specified timezone and returns the correct UTC instant.
    const date = fromZonedTime(isoLikeString, timeZone);
    
    if (isValid(date)) {
        return date;
    }

    console.warn(`[SYNC-VA-CARELOGS] Constructed an invalid date from "${dateStr}".`);
    return null;
}


export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pacificTimeZone = 'America/Los_Angeles';

    // 1. Calculate cutoff date for deletion: Saturday 11:59 PM PT of 4 weeks ago
    const nowInPT = toDateTz(new Date(), { timeZone: pacificTimeZone });
    const fourWeeksAgoDate = subWeeks(nowInPT, 4);
    const dayOfWeekFourWeeksAgo = getDay(fourWeeksAgoDate); // Sunday is 0, Saturday is 6
    const daysUntilSaturday = (6 - dayOfWeekFourWeeksAgo + 7) % 7;
    const targetSaturday = addDays(fourWeeksAgoDate, daysUntilSaturday);
    const endOfTargetSaturday = setDate(targetSaturday, { hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });
    const cutoffTimestamp = Timestamp.fromDate(endOfTargetSaturday);

    console.log(`[SYNC-VA-CARELOGS] Deleting records with date on or before ${endOfTargetSaturday.toISOString()}`);
    
    // 2. Delete old documents based on the calculated cutoff
    const shiftsToDeleteQuery = serverDb.collection('va_teletrack_shifts').where('date', '<=', cutoffTimestamp);
    const shiftsToDeleteSnapshot = await shiftsToDeleteQuery.get();
    let deletedCount = 0;
    
    if (!shiftsToDeleteSnapshot.empty) {
        const deleteBatch = serverDb.batch();
        shiftsToDeleteSnapshot.docs.forEach(doc => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        deletedCount = shiftsToDeleteSnapshot.size;
        console.log(`[SYNC-VA-CARELOGS] Cleared ${deletedCount} old shifts.`);
    }

    // 3. Fetch shifts that were NOT deleted to check for duplicates before inserting
    const existingShiftsQuery = serverDb.collection('va_teletrack_shifts').where('date', '>', cutoffTimestamp);
    const existingShiftsSnapshot = await existingShiftsQuery.get();
    const existingShiftsSet = new Set<string>();
    existingShiftsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.date && data.clientId) {
            const shiftDate = data.date.toDate();
            // Format the date correctly based on the target timezone
            const formattedDate = formatInTimeZone(shiftDate, pacificTimeZone, 'yyyy-MM-dd');
            existingShiftsSet.add(`${data.clientId}|${formattedDate}`);
        }
    });
    console.log(`[SYNC-VA-CARELOGS] Found ${existingShiftsSet.size} existing recent shifts to check against for duplicates.`);

    // 4. Load and insert new data from JSON file
    const bucket = getStorage(serverApp).bucket(process.env.GCLOUD_STORAGE_BUCKET || 'gs://firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('CareLogs/VA_CareLogs/TeleTrack-VA-CareLogs.json');
    const [contents] = await file.download();
    const jsonData = JSON.parse(contents.toString());
    
    if (!jsonData || !Array.isArray(jsonData.clients)) {
        console.error("[SYNC-VA-CARELOGS] Parsed JSON does not contain a 'clients' array.");
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
        const parts = trimmedName.split(',').map((p: string) => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          const normalizedName = `${parts[1]} ${parts[0]}`;
          caregiverNameToIdMap.set(normalizedName, doc.id);
        }
        caregiverNameToIdMap.set(trimmedName, doc.id);
      }
    });

    let insertBatch = serverDb.batch();
    let operations = 0;
    let shiftsAdded = 0;
    let shiftsSkipped = 0;

    for (const client of clients) {
      if (!client.schedules || client.schedules.length === 0) {
        continue;
      }
      
      const parsedClientName = parseClientName(client.clientName);

      for (const schedule of client.schedules) {
        const scheduleDate = parseTeletrackDate(schedule.date, pacificTimeZone);
        if (!scheduleDate) {
            console.warn(`[SYNC-VA-CARELOGS] Skipping schedule for client ${client.clientId} due to invalid date: ${schedule.date}`);
            continue;
        }

        // 5. Idempotency Check
        const formattedDateKey = formatInTimeZone(scheduleDate, pacificTimeZone, 'yyyy-MM-dd');
        const shiftKey = `${client.clientId}|${formattedDateKey}`;
        if (existingShiftsSet.has(shiftKey)) {
            shiftsSkipped++;
            continue; // Skip this record as it's a duplicate
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

        const docRef = serverDb.collection('va_teletrack_shifts').doc();
        insertBatch.set(docRef, shiftDoc);
        operations++;
        shiftsAdded++;
        existingShiftsSet.add(shiftKey); // Add to set to handle duplicates within the JSON file
        
        if (operations >= 499) {
            await insertBatch.commit();
            operations = 0;
            insertBatch = serverDb.batch();
        }
      }
    }

    if (operations > 0) {
      await insertBatch.commit();
      console.log("[SYNC-VA-CARELOGS] Committed final batch of VA shift records.");
    }

    const message = `Sync complete. Deleted ${deletedCount} old records. Added ${shiftsAdded} new records. Skipped ${shiftsSkipped} duplicate records.`;
    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-va-carelogs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
