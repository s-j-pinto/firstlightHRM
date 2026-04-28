
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { startOfWeek, subWeeks, endOfWeek, parse } from 'date-fns';
import { format as formatInTimeZone, fromZonedTime } from 'date-fns-tz';

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

/**
 * Parses a date string like "Sun 5/3/2026" and correctly interprets it as a date
 * in the 'America/Los_Angeles' timezone, returning a UTC Date object.
 * @param dateStr The date string from the Teletrack JSON.
 * @returns A Date object representing the start of that day in UTC, or null.
 */
function parseTeletrackDate(dateStr: string, logMessages: string[]): Date | null {
    if (!dateStr || typeof dateStr !== 'string') {
        logMessages.push(`[WARN] Invalid date input provided: ${dateStr}`);
        return null;
    }
    const pacificTimeZone = 'America/Los_Angeles';

    // Matches dates like "Sun 5/3/2026" or "5/3/2026"
    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) {
        logMessages.push(`[WARN] Could not find a valid date pattern in "${dateStr}".`);
        return null;
    }

    const [, month, day, year] = dateMatch;
    // Construct a standard, unambiguous date string
    const localDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    try {
        // This correctly creates a Date object representing midnight in the specified timezone
        const zonedDate = fromZonedTime(localDateString, pacificTimeZone);
        logMessages.push(`[DEBUG] Parsed "${dateStr}" as Pacific Time. Resulting UTC timestamp: ${zonedDate.toISOString()}`);
        return zonedDate;
    } catch (e: any) {
        logMessages.push(`[ERROR] Error parsing date string "${localDateString}" for timezone "${pacificTimeZone}": ${e.message}`);
        return null;
    }
}


async function getExistingShiftsMap(clientName: string, weekStart: Date, weekEnd: Date): Promise<Set<string>> {
    const existingShifts = new Set<string>();
    const shiftsSnap = await serverDb.collection('va_teletrack_shifts')
        .where('clientName', '==', clientName)
        .where('date', '>=', weekStart)
        .where('date', '<=', weekEnd)
        .get();

    shiftsSnap.forEach(doc => {
        const shift = doc.data();
        const shiftDate = shift.date.toDate();
        // Convert to YYYY-MM-DD in Pacific Time for a consistent key
        const key = formatInTimeZone(shiftDate, 'yyyy-MM-dd', { timeZone: 'America/Los_Angeles' });
        existingShifts.add(key);
    });
    return existingShifts;
}


export async function GET(request: NextRequest) {
  const logMessages: string[] = [`[SYNC-VA-CARELOGS] Job started at ${new Date().toISOString()}`];
  
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logMessages.push('[ERROR] Unauthorized access attempt.');
    // Even on auth error, we might want to save the log, but for now, we just return.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logMessages.push("Fetching VA CareLogs JSON from storage...");
    const bucket = getStorage(serverApp).bucket(process.env.GCLOUD_STORAGE_BUCKET || 'gs://firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('CareLogs/VA_CareLogs/TeleTrack-VA-CareLogs.json');
    const [contents] = await file.download();
    const jsonData = JSON.parse(contents.toString());
    logMessages.push("Successfully fetched and parsed JSON.");
    
    if (!jsonData || !Array.isArray(jsonData.clients)) {
        throw new Error("Parsed JSON does not contain a 'clients' array.");
    }
    const clients = jsonData.clients;
    logMessages.push(`Found ${clients.length} clients in the JSON file.`);

    logMessages.push("Fetching active caregivers from Firestore...");
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
    logMessages.push(`Created a map of ${caregiverNameToIdMap.size} active caregivers.`);

    const now = new Date();
    // Corrected logic: Go back 4 weeks from the start of the current week.
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const weekStart = subWeeks(startOfCurrentWeek, 4);

    logMessages.push("Checking for and deleting records older than 5 weeks...");
    const cutoffDate = endOfWeek(subWeeks(now, 5), { weekStartsOn: 0 });
    const shiftsToDeleteQuery = serverDb.collection('va_teletrack_shifts').where('date', '<=', cutoffDate);
    const shiftsToDeleteSnapshot = await shiftsToDeleteQuery.get();
    
    let deleteBatch = serverDb.batch();
    let deleteOps = 0;
    shiftsToDeleteSnapshot.forEach(doc => {
        deleteBatch.delete(doc.ref);
        deleteOps++;
        if (deleteOps >= 499) {
            deleteBatch.commit();
            deleteBatch = serverDb.batch();
            deleteOps = 0;
        }
    });
    if (deleteOps > 0) {
        await deleteBatch.commit();
    }
    logMessages.push(`Deleted ${shiftsToDeleteSnapshot.size} old shift records.`);

    let addBatch = serverDb.batch();
    let addOps = 0;
    let shiftsAdded = 0;
    let shiftsSkipped = 0;

    for (const client of clients) {
      if (!client.schedules || client.schedules.length === 0) {
        continue;
      }
      
      const parsedClientName = parseClientName(client.clientName);
      logMessages.push(`\n--- Processing client: ${parsedClientName} ---`);
      
      const existingShifts = await getExistingShiftsMap(parsedClientName, weekStart, now);
      logMessages.push(`[${parsedClientName}] Found ${existingShifts.size} existing shift keys in DB for the current and past 4 weeks: [${[...existingShifts].join(', ')}]`);

      for (const schedule of client.schedules) {
        const scheduleDate = parseTeletrackDate(schedule.date, logMessages);
        if (!scheduleDate) {
            logMessages.push(`[WARN] Skipping schedule for client ${client.clientId} due to invalid date: ${schedule.date}`);
            continue;
        }
        
        const dateKey = formatInTimeZone(scheduleDate, 'yyyy-MM-dd', { timeZone: 'America/Los_Angeles' });
        if (existingShifts.has(dateKey)) {
            shiftsSkipped++;
            logMessages.push(` -> [${parsedClientName}] Processing date ${schedule.date}: Key '${dateKey}' - MATCH FOUND. Skipping duplicate shift.`);
            continue;
        } else {
             logMessages.push(` -> [${parsedClientName}] Processing date ${schedule.date}: Key '${dateKey}' - NO MATCH. Adding new shift.`);
        }

        const jsonCaregiverName = `${schedule.caregiver.firstName} ${schedule.caregiver.lastName}`;
        const caregiverId = caregiverNameToIdMap.get(jsonCaregiverName.toLowerCase()) || null;

        if (!caregiverId) {
            logMessages.push(`[WARN] Could not find matching caregiver ID for: "${jsonCaregiverName}"`);
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
        addBatch.set(docRef, shiftDoc);
        addOps++;
        shiftsAdded++;
        
        if (addOps >= 499) {
            await addBatch.commit();
            addOps = 0;
            addBatch = serverDb.batch();
        }
      }
    }

    if (addOps > 0) {
      await addBatch.commit();
    }
    
    const message = `Sync complete. Added: ${shiftsAdded}, Skipped (Duplicates): ${shiftsSkipped}, Deleted (Old): ${shiftsToDeleteSnapshot.size}.`;
    logMessages.push(`\n[SYNC-VA-CARELOGS] ${message}`);
    
    try {
        const bucket = getStorage(serverApp).bucket(process.env.GCLOUD_STORAGE_BUCKET || 'gs://firstlighthomecare-hrm.firebasestorage.app');
        const file = bucket.file('CareLogs/VA_CareLogs/run.log');
        await file.save(logMessages.join('\n'));
        console.log('[SYNC-VA-CARELOGS] Log file saved to storage.');
    } catch (logError: any) {
        console.error('[SYNC-VA-CARELOGS] FAILED TO SAVE LOG FILE:', logError);
    }
    
    return NextResponse.json({ success: true, message });

  } catch (error: any) {
    logMessages.push(`\n[CRON-ERROR] Job failed unexpectedly: ${error.message}`);
    console.error('[CRON-ERROR] /api/cron/sync-va-carelogs:', error);
    
    try {
        const bucket = getStorage(serverApp).bucket(process.env.GCLOUD_STORAGE_BUCKET || 'gs://firstlighthomecare-hrm.firebasestorage.app');
        const file = bucket.file('CareLogs/VA_CareLogs/run.log');
        await file.save(logMessages.join('\n'));
        console.log('[SYNC-VA-CARELOGS] Error log file saved to storage.');
    } catch (logError: any) {
        console.error('[SYNC-VA-CARELOGS] FAILED TO SAVE ERROR LOG FILE:', logError);
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
