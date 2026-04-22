import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { parse as parseDate } from 'date-fns';

// Helper to parse the inconsistent client name string
function parseClientName(fullName: string): string {
    if (!fullName) return "Unknown Client";
    // Takes the part before the first parenthesis, which usually contains the name
    return fullName.split('(')[0].replace(/,\s*$/, '').trim();
}

// Helper to parse date strings like "Mon 4/20/2026"
function parseTeletrackDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Remove the day of the week part, e.g., "Mon "
    const cleanDateStr = dateStr.substring(dateStr.indexOf(' ') + 1);
    try {
        const parsed = parseDate(cleanDateStr, 'M/d/yyyy', new Date());
        return parsed;
    } catch (e) {
        console.error(`Failed to parse date: ${dateStr}`);
        return null;
    }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bucket = getStorage().bucket('firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('CareLogs/VA_CareLogs/TeleTrack-VA-CareLogs.json');
    const [contents] = await file.download();
    const jsonData = JSON.parse(contents.toString());
    const clients = jsonData.clients;

    const batch = serverDb.batch();
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

        const shiftDoc = {
          clientId: client.clientId,
          clientName: parsedClientName,
          date: Timestamp.fromDate(scheduleDate),
          day: schedule.day,
          caregiverName: `${schedule.caregiver.firstName} ${schedule.caregiver.lastName}`,
          ratePlan: schedule.ratePlan,
          arrivalTime: schedule.arrivalTime,
          departureTime: schedule.departureTime,
          createdAt: Timestamp.now(),
        };

        const docRef = serverDb.collection('va_teletrack_shifts').doc(); // Auto-generate ID
        batch.set(docRef, shiftDoc);
        operations++;
        shiftsAdded++;
        
        if (operations >= 499) {
            await batch.commit();
            operations = 0;
            console.log("Committed a batch of VA shift records.");
            batch = serverDb.batch();
        }
      }
    }

    if (operations > 0) {
      await batch.commit();
      console.log("Committed final batch of VA shift records.");
    }

    return NextResponse.json({ success: true, message: `Successfully synced ${shiftsAdded} VA Teletrack shifts.` });
  } catch (error: any) {
    console.error('[CRON-ERROR] /api/cron/sync-va-carelogs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
