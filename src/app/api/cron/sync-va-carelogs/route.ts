
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { startOfWeek, subWeeks, endOfWeek } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

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
function parseTeletrackDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') {
        console.warn(`[SYNC-VA-CARELOGS] Invalid date input provided: ${dateStr}`);
        return null;
    }
    const pacificTimeZone = 'America/Los_Angeles';

    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) {
        console.warn(`[SYNC-VA-CARELOGS] Could not find a date pattern in "${dateStr}".`);
        return null;
    }

    const [, month, day, year] = dateMatch;
    // IMPORTANT FIX: Using "YYYY-MM-DD HH:mm:ss" format, which is less ambiguous for time-zone-aware parsing
    // than the "T" separator, to represent midnight on the given day.
    const localDateTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`;

    try {
        // fromZonedTime correctly interprets the localDateTimeString as a "wall clock" time
        // within the specified timezone and returns the corresponding UTC Date object.
        const utcDate = fromZonedTime(localDateTimeString, pacificTimeZone);
        
        console.log(`[SYNC-VA-CARELOGS] Parsed "${dateStr}" as Pacific Time. Resulting UTC timestamp: ${utcDate.toISOString()}`);
        
        return utcDate;
    } catch (e) {
        console.error(`[SYNC-VA-CARELOGS] Error parsing date string "${localDateTimeString}" for timezone "${pacificTimeZone}"`, e);
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
        const key = formatInTimeZone(shiftDate, 'America/Los_Angeles', 'yyyy-MM-dd');
        existingShifts.add(key);
    });
    return existingShifts;
}


export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const now = new Date();
    // Use Sunday as the start of the week for calculations.
    const weekStart = startOfWeek(subWeeks(now, 4), { weekStartsOn: 0 }); 

    // Delete records older than the cutoff
    const cutoffDate = endOfWeek(subWeeks(now, 5), { weekStartsOn: 0 }); // End of Saturday 5 weeks ago
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
    console.log(`[SYNC-VA-CARELOGS] Deleted ${shiftsToDeleteSnapshot.size} old shift records.`);

    let addBatch = serverDb.batch();
    let addOps = 0;
    let shiftsAdded = 0;
    let shiftsSkipped = 0;

    for (const client of clients) {
      if (!client.schedules || client.schedules.length === 0) {
        continue;
      }
      
      const parsedClientName = parseClientName(client.clientName);
      const existingShifts = await getExistingShiftsMap(parsedClientName, weekStart, now);

      for (const schedule of client.schedules) {
        const scheduleDate = parseTeletrackDate(schedule.date);
        if (!scheduleDate) {
            console.warn(`[SYNC-VA-CARELOGS] Skipping schedule for client ${client.clientId} due to invalid date: ${schedule.date}`);
            continue;
        }
        
        const dateKey = formatInTimeZone(scheduleDate, 'America/Los_Angeles', 'yyyy-MM-dd');
        if (existingShifts.has(dateKey)) {
            shiftsSkipped++;
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
    console.log(`[SYNC-VA-CARELOGS] ${message}`);
    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-va-carelogs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
